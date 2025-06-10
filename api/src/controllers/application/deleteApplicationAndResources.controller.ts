import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import Application from "../../models/application.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { log, formatNotification } from "../../utils/logger";

const deleteApplicationAndResources = asyncHandler(
  async (req: Request, res: Response) => {
    const app = await Application.findById(req.params.id);
    if (!app) {
      log({ type: "error", message: "Application not found" });
      return res
        .status(404)
        .json(formatNotification("Application not found", "error"));
    }

    const namespace = app.namespace;
    const userId = (app.owner as any).toString();
    const appId = (app._id as any).toString();
    const manifestsDir = process.env.MANIFESTS_DIR;
    const appDir = manifestsDir ? path.join(manifestsDir, userId, appId) : null;

    // Check if namespace exists before attempting to delete
    let namespaceExists = false;
    if (namespace) {
      try {
        await new Promise<void>((resolve) => {
          exec(`kubectl get namespace ${namespace}`, (err, stdout) => {
            if (!err && stdout && stdout.includes(namespace)) {
              namespaceExists = true;
            }
            resolve();
          });
        });
      } catch {}
    }

    // Delete namespace and all resources in it if it exists
    if (namespaceExists) {
      await new Promise<void>((resolve, reject) => {
        exec(
          `kubectl delete namespace ${namespace}`,
          (err, _stdout, stderr) => {
            if (err && !(stderr && stderr.includes("not found"))) {
              return reject(stderr);
            }
            resolve();
          }
        );
      });
    }

    // Remove manifests folder if it exists
    if (appDir && fs.existsSync(appDir)) {
      const { rimraf } = await import("rimraf");
      await rimraf(appDir);
    }

    // Remove from DB
    try {
      await Application.findByIdAndDelete(req.params.id);
      log({
        type: "success",
        message: `Application and all resources deleted: ${app.name}`,
      });
      res.json(
        formatNotification("Application and all resources deleted", "success")
      );
    } catch (err) {
      log({
        type: "error",
        message: "Failed to delete application and resources",
        meta: err,
      });
      res
        .status(500)
        .json(
          formatNotification(
            "Failed to delete application and resources",
            "error"
          )
        );
    }
  }
);

export default deleteApplicationAndResources;
