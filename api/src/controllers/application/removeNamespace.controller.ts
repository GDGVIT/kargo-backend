import { Request, Response } from "express";
import { exec } from "child_process";
import Application from "../../models/application.model";
import asyncHandler from "../../utils/handlers/asyncHandler";
import log, { formatNotification } from "../../utils/logging/logger";

const removeNamespace = asyncHandler(async (req: Request, res: Response) => {
  const app = await Application.findById(req.params.id);
  if (!app) {
    log({ type: "error", message: "Application not found" });
    return res
      .status(404)
      .json(formatNotification("Application not found", "error"));
  }
  const namespace = app.namespace;
  exec(`kubectl delete namespace ${namespace}`, (err, stdout, stderr) => {
    if (err) {
      log({
        type: "error",
        message: "Failed to remove namespace",
        meta: err,
      });
      return res.status(500).json({
        ...formatNotification("Failed to remove namespace", "error"),
        error: stderr,
      });
    }
    log({ type: "success", message: `Namespace removed: ${namespace}` });
    res.json({
      ...formatNotification("Namespace removed", "success"),
      output: stdout,
    });
  });
});

export default removeNamespace;
