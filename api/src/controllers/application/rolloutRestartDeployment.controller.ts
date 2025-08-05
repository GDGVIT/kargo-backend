import { Request, Response } from "express";
import Application from "../../models/application.model";
import asyncHandler from "../../utils/handlers/asyncHandler";
import log, { formatNotification } from "../../utils/logging/logger";
import k8sClient from "../../utils/k8s/client";

const rolloutRestartDeployment = asyncHandler(
  async (req: Request, res: Response) => {
    const app = await Application.findById(req.params.id);
    if (!app) {
      log({ type: "error", message: "Application not found" });
      return res
        .status(404)
        .json(formatNotification("Application not found", "error"));
    }
    
    const namespace = app.namespace || "default";
    const deploymentName = app.deploymentName || app.name;
    
    try {
      // Use secure Kubernetes client instead of direct kubectl command
      const result = await k8sClient.restartDeployment(`${deploymentName}-deployment`, namespace);
      
      log({
        type: "success",
        message: `Deployment rollout restarted for app: ${app.name}`,
      });
      res.json({
        ...formatNotification("Deployment rollout restarted", "success"),
        output: result.message,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log({
        type: "error",
        message: "Failed to rollout restart deployment",
        meta: error,
      });
      return res.status(500).json({
        ...formatNotification("Failed to restart deployment", "error"),
        error: errorMessage,
      });
    }
  }
);

export default rolloutRestartDeployment;
