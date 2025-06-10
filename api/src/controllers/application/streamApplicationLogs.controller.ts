import { Request, Response } from "express";
import { spawn } from "child_process";
import Application from "../../models/application.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { log, formatNotification } from "../../utils/logger";

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
    // Get pod name by label selector (assume 1 pod per deployment)
    console.log(
      "[streamApplicationLogs] Using namespace:",
      namespace,
      "app:",
      app.name
    );
    const getPod = spawn(
      "kubectl",
      [
        "get",
        "pods",
        "-n",
        namespace ?? "default",
        "-l",
        `app=${app.name}`,
        "-o",
        "jsonpath={.items[0].metadata.name}",
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let podName = "";
    (getPod.stdout as NodeJS.ReadableStream).on("data", (data: Buffer) => {
      podName += data.toString();
    });
    (getPod.stderr as NodeJS.ReadableStream).on("data", (data: Buffer) => {
      log({
        type: "error",
        message: `[streamApplicationLogs] getPod stderr: ${data.toString()}`,
      });
    });
    getPod.on("close", (_code: number) => {
      log({
        type: podName ? "info" : "error",
        message: `[streamApplicationLogs] Pod name found: ${podName}`,
      });
      if (!podName) {
        log({ type: "error", message: "Pod not found" });
        res.status(404).json(formatNotification("Pod not found", "error"));
        return;
      }
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      const logs = spawn(
        "kubectl",
        ["logs", podName, "-n", namespace ?? "default", "-f"],
        { stdio: ["ignore", "pipe", "pipe"] }
      );
      (logs.stdout as NodeJS.ReadableStream).on("data", (data: Buffer) => {
        res.write(`data: ${data.toString().replace(/\n/g, "\ndata: ")}\n\n`);
      });
      (logs.stderr as NodeJS.ReadableStream).on("data", (data: Buffer) => {
        log({
          type: "error",
          message: `[streamApplicationLogs] logs stderr: ${data.toString()}`,
        });
        res.write(
          `data: [stderr] ${data.toString().replace(/\n/g, "\ndata: ")}\n\n`
        );
      });
      logs.on("close", () => {
        res.write("event: end\ndata: [log stream ended]\n\n");
        res.end();
      });
      req.on("close", () => {
        logs.kill();
      });
    });
  }
);

export default streamApplicationLogs;
