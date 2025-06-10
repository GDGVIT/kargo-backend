import { Request, Response } from "express";
import Application from "../../models/application.model";
import { asyncHandler } from "../../utils/handlers/asyncHandler";
import { log, formatNotification } from "../../utils/logging/logger";

const deleteApplication = asyncHandler(async (req: Request, res: Response) => {
  const app = await Application.findByIdAndDelete(req.params.id);
  if (!app) {
    log({ type: "error", message: "Application not found" });
    return res
      .status(404)
      .json(formatNotification("Application not found", "error"));
  }
  log({ type: "success", message: `Application deleted: ${app.name}` });
  res.json(formatNotification("Application deleted", "success"));
});

export default deleteApplication;
