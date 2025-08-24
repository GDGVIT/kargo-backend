import { Request, Response } from "express";
import Application from "../../models/application.model";
import asyncHandler from "../../utils/handlers/asyncHandler";
import log, { formatNotification } from "../../utils/logging/logger";
import k8sClient from "../../utils/k8s/client";

const removeNamespace = asyncHandler(async (req: Request, res: Response) => {
  const app = await Application.findById(req.params.id);
  if (!app) {
    log({ type: "error", message: "Application not found" });
    return res
      .status(404)
      .json(formatNotification("Application not found", "error"));
  }
  
  const namespace = app.namespace;
  
  if (!namespace) {
    log({ type: "error", message: "Application namespace is undefined" });
    return res
      .status(500)
      .json(formatNotification("Application namespace is undefined", "error"));
  }
  
  try {
    // Use secure Kubernetes client instead of direct kubectl command
    const result = await k8sClient.deleteNamespace(namespace);
    
    log({ type: "success", message: `Namespace removed: ${namespace}` });
    res.json({
      ...formatNotification("Namespace removed", "success"),
      output: result.message,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log({
      type: "error",
      message: "Failed to remove namespace",
      meta: error,
    });
    return res.status(500).json({
      ...formatNotification("Failed to remove namespace", "error"),
      error: errorMessage,
    });
  }
});

export default removeNamespace;
