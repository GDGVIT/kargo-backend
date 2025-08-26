import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import Application from "../../models/application.model";
import asyncHandler from "../../utils/handlers/asyncHandler";
import log, { formatNotification } from "../../utils/logging/logger";
import env from "../../config/env";
import k8sClient from "../../utils/k8s/client";

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

  try {
    // Use secure Kubernetes client instead of direct kubectl command
    const results = [];

    if (fs.existsSync(appDir)) {
      // Read and delete each manifest file using SDK
      const files = fs
        .readdirSync(appDir)
        .filter((file) => file.endsWith(".yaml"));

      for (const file of files) {
        const filePath = path.join(appDir, file);
        const content = fs.readFileSync(filePath, "utf8");
        const result = await k8sClient.deleteResource(content);
        results.push(result);
      }
    }

    log({
      type: "success",
      message: `Deployment removed for app: ${app.name}`,
    });
    res.json({
      ...formatNotification("Deployment removed", "success"),
      output: `Successfully deleted ${results.length} resources`,
      results,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log({
      type: "error",
      message: "Failed to remove deployment",
      meta: error,
    });
    return res.status(500).json({
      ...formatNotification("Failed to remove deployment", "error"),
      error: errorMessage,
    });
  }
});

export default removeDeployment;
