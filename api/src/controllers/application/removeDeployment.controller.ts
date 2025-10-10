import { Request, Response } from "express";
import path from "path";
import { exec } from "child_process";
import Application from "../../models/application.model";
import asyncHandler from "../../utils/handlers/asyncHandler";
import log, { formatNotification } from "../../utils/logging/logger";
import env from "../../config/env";

const removeDeployment = asyncHandler(async (req: Request, res: Response) => {
	const app = await Application.findById(req.params.id);
	if (!app) {
		log({ type: "error", message: "Application not found" });
		return res
			.status(404)
			.json(formatNotification("Application not found", "error"));
	}
	const userId = (app.owner as any).toString();
	const appId = (app._id as any).toString();
	const manifestsDir = env.MANIFESTS_DIR;
	if (!manifestsDir) {
		log({ type: "error", message: "MANIFESTS_DIR not set in env" });
		return res
			.status(500)
			.json(formatNotification("MANIFESTS_DIR not set in env", "error"));
	}
	const appDir = path.join(manifestsDir, userId, appId);
	exec(`kubectl delete -f .`, { cwd: appDir }, (err, stdout, stderr) => {
		if (err) {
			log({
				type: "error",
				message: "Failed to remove deployment",
				meta: err,
			});
			return res.status(500).json({
				...formatNotification("Failed to remove deployment", "error"),
				error: stderr,
			});
		}
		log({
			type: "success",
			message: `Deployment removed for app: ${app.name}`,
		});
		res.json({
			...formatNotification("Deployment removed", "success"),
			output: stdout,
		});
	});
});

export default removeDeployment;
