import { Request, Response } from "express";
import { spawn } from "child_process";
import Application from "../../models/application.model";
import asyncHandler from "../../utils/handlers/asyncHandler";
import log, { formatNotification } from "../../utils/logging/logger";

const LOG_TAIL_COUNT = 200;
const LOG_THROTTLE_MS = 100;

const streamApplicationLogs = asyncHandler(
	async (req: Request, res: Response) => {
		const app = await Application.findById(req.params.id);
		if (!app) {
			log({ type: "error", message: "Application not found" });
			return res
				.status(404)
				.json(formatNotification("Application not found", "error"));
		}
		const namespace = app.namespace;
		log({
			type: "info",
			message: `[streamApplicationLogs] Using namespace: ${namespace}, app: ${app.name}`,
		});
		// Get all pod names for the app
		const getPods = spawn(
			"kubectl",
			[
				"get",
				"pods",
				"-n",
				namespace ?? "default",
				"-l",
				`app=${app.name}`,
				"-o",
				"jsonpath={.items[*].metadata.name}",
			],
			{ stdio: ["ignore", "pipe", "pipe"] }
		);
		let podsOutput = "";
		(getPods.stdout as NodeJS.ReadableStream).on("data", (data: Buffer) => {
			podsOutput += data.toString();
		});
		(getPods.stderr as NodeJS.ReadableStream).on("data", (data: Buffer) => {
			log({
				type: "error",
				message: `[streamApplicationLogs] getPods stderr: ${data.toString()}`,
			});
		});
		getPods.on("close", (_code: number) => {
			const podNames = podsOutput.trim().split(/\s+/).filter(Boolean);
			log({
				type: podNames.length ? "info" : "error",
				message: `[streamApplicationLogs] Pod names found: ${podNames.join(
					", "
				)}`,
			});
			if (!podNames.length) {
				log({ type: "error", message: "No pods found" });
				res.status(404).json(formatNotification("No pods found", "error"));
				return;
			}
			res.setHeader("Content-Type", "text/event-stream");
			res.setHeader("Cache-Control", "no-cache");
			res.setHeader("Connection", "keep-alive");
			res.flushHeaders();
			// For each pod, stream logs
			const logProcesses = podNames.map((podName) => {
				return {
					podName,
					proc: spawn(
						"kubectl",
						[
							"logs",
							podName,
							"-n",
							namespace ?? "default",
							`--tail=${LOG_TAIL_COUNT}`,
							"-f",
						],
						{ stdio: ["ignore", "pipe", "pipe"] }
					),
					buffer: "",
					sending: false,
				};
			});
			// Helper to send logs for a pod
			const sendBufferedLogs = (logObj: any) => {
				if (logObj.sending || !logObj.buffer) return;
				logObj.sending = true;
				// Prefix each line with timestamp and pod name
				const lines = logObj.buffer.split("\n").filter(Boolean);
				for (const line of lines) {
					const timestamp = new Date().toISOString();
					res.write(`data: ${timestamp} [${logObj.podName}] ${line}\n\n`);
				}
				logObj.buffer = "";
				setTimeout(() => {
					logObj.sending = false;
					if (logObj.buffer) sendBufferedLogs(logObj);
				}, LOG_THROTTLE_MS);
			};
			// Attach listeners for each pod log process
			logProcesses.forEach((logObj) => {
				(logObj.proc.stdout as NodeJS.ReadableStream).on(
					"data",
					(data: Buffer) => {
						logObj.buffer += data.toString();
						sendBufferedLogs(logObj);
					}
				);
				(logObj.proc.stderr as NodeJS.ReadableStream).on(
					"data",
					(data: Buffer) => {
						log({
							type: "error",
							message: `[streamApplicationLogs] logs stderr: ${data.toString()}`,
						});
						logObj.buffer += `[stderr] ${data.toString()}`;
						sendBufferedLogs(logObj);
					}
				);
				logObj.proc.on("close", () => {
					const timestamp = new Date().toISOString();
					res.write(
						`event: end\ndata: ${timestamp} [${logObj.podName}] [log stream ended]\n\n`
					);
				});
			});
			req.on("close", () => {
				logProcesses.forEach((logObj) => logObj.proc.kill());
			});
		});
	}
);

export default streamApplicationLogs;
