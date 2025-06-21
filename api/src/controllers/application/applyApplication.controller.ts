import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import Application from "../../models/application.model";
import asyncHandler from "../../utils/handlers/asyncHandler";
import generateK8sManifests from "../../utils/k8s/k8sManifests";
import log, { formatNotification } from "../../utils/logging/logger";
import type IApplication from "../../types/application.types";
import type { Document } from "mongoose";
import env from "../../config/env";

const applyApplication = asyncHandler(async (req: Request, res: Response) => {
  const app = (await Application.findById(req.params.id)) as
    | (IApplication & Document)
    | null;
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

  if (fs.existsSync(appDir)) {
    fs.rmSync(appDir, { recursive: true, force: true });
  }
  fs.mkdirSync(appDir, { recursive: true });

  const {
    deploymentYaml,
    serviceYaml,
    ingressYaml,
    secretYaml,
    imagePullSecretYaml,
  } = generateK8sManifests(app);
  if (!app.namespace) {
    log({ type: "error", message: "Application namespace is undefined" });
    return res
      .status(500)
      .json(formatNotification("Application namespace is undefined", "error"));
  }

  // Log manifest directory and file paths
  log({ type: "info", message: `[applyApplication] appDir: ${appDir}` });

  fs.writeFileSync(
    path.join(appDir, "namespace.yaml"),
    `apiVersion: v1\nkind: Namespace\nmetadata:\n  name: ${app.namespace}\n`
  );
  fs.writeFileSync(path.join(appDir, "secret.yaml"), secretYaml || "");
  if (imagePullSecretYaml) {
    fs.writeFileSync(
      path.join(appDir, "imagepullsecret.yaml"),
      imagePullSecretYaml
    );
  }
  fs.writeFileSync(path.join(appDir, "deployment.yaml"), deploymentYaml);
  fs.writeFileSync(path.join(appDir, "service.yaml"), serviceYaml);
  if (ingressYaml)
    fs.writeFileSync(path.join(appDir, "ingress.yaml"), ingressYaml);

  // Log manifest contents
  const manifestFiles = [
    "namespace.yaml",
    "secret.yaml",
    ...(imagePullSecretYaml ? ["imagepullsecret.yaml"] : []),
    "deployment.yaml",
    "service.yaml",
    "ingress.yaml",
  ];
  for (const file of manifestFiles) {
    const filePath = path.join(appDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      log({
        type: "info",
        message: `[applyApplication] ${file} content:\n${content}`,
      });
    }
  }

  // Apply namespace first, then secret, then imagePullSecret, then the rest
  exec(
    `kubectl apply -f namespace.yaml`,
    { cwd: appDir },
    (errNs, stdoutNs, stderrNs) => {
      log({
        type: errNs ? "error" : "info",
        message: `[applyApplication] namespace apply stdout:\n${stdoutNs}`,
      });
      log({
        type: errNs ? "error" : "info",
        message: `[applyApplication] namespace apply stderr:\n${stderrNs}`,
      });
      if (errNs) {
        log({
          type: "error",
          message: "Failed to apply namespace",
          meta: errNs,
        });
        return res.status(500).json({
          ...formatNotification("Failed to apply namespace", "error"),
          error: stderrNs,
        });
      }

      exec(
        `kubectl apply -f secret.yaml`,
        { cwd: appDir },
        (err, stdout, stderr) => {
          log({
            type: err ? "error" : "info",
            message: `[applyApplication] secret apply stdout:\n${stdout}`,
          });
          log({
            type: err ? "error" : "info",
            message: `[applyApplication] secret apply stderr:\n${stderr}`,
          });
          if (err) {
            const secretContent = fs.readFileSync(
              path.join(appDir, "secret.yaml"),
              "utf8"
            );
            log({
              type: "error",
              message: "Failed to apply secret",
              meta: err,
            });
            log({
              type: "error",
              message: `[applyApplication] secret manifest content:\n${secretContent}`,
            });
            return res.status(500).json({
              ...formatNotification("Failed to apply secret", "error"),
              error: stderr,
              secret: secretContent,
            });
          }
          if (imagePullSecretYaml) {
            exec(
              `kubectl apply -f imagepullsecret.yaml`,
              { cwd: appDir },
              (errImg, stdoutImg, stderrImg) => {
                if (errImg) {
                  log({
                    type: "error",
                    message: "Failed to apply imagePullSecret",
                    meta: errImg,
                  });
                  return res.status(500).json({
                    ...formatNotification(
                      "Failed to apply imagePullSecret",
                      "error"
                    ),
                    error: stderrImg,
                    secret: imagePullSecretYaml,
                  });
                }
                // Continue to apply the rest
                exec(
                  `kubectl apply -f . --prune -l app=${app.name} --field-manager=application-controller`,
                  { cwd: appDir },
                  (err2, stdout2, stderr2) => {
                    log({
                      type: err2 ? "error" : "info",
                      message: `[applyApplication] manifests apply stdout:\n${stdout2}`,
                    });
                    log({
                      type: err2 ? "error" : "info",
                      message: `[applyApplication] manifests apply stderr:\n${stderr2}`,
                    });
                    if (err2) {
                      // Read all manifest files for debugging
                      const manifests: Record<string, string> = {};
                      for (const file of manifestFiles) {
                        const filePath = path.join(appDir, file);
                        if (fs.existsSync(filePath)) {
                          manifests[file] = fs.readFileSync(filePath, "utf8");
                        }
                      }
                      log({
                        type: "error",
                        message: "Failed to apply manifests",
                        meta: err2,
                      });
                      return res.status(500).json({
                        ...formatNotification(
                          "Failed to apply manifests",
                          "error"
                        ),
                        error: stderr2,
                        output: stdout2,
                        manifests,
                      });
                    }
                    log({
                      type: "success",
                      message: `Application applied: ${app.name}`,
                    });
                    res.json({
                      ...formatNotification("Application applied", "success"),
                      output: stdoutNs + stdout + stdout2,
                    });
                  }
                );
              }
            );
          } else {
            exec(
              `kubectl apply -f . --prune -l app=${app.name} --field-manager=application-controller`,
              { cwd: appDir },
              (err2, stdout2, stderr2) => {
                log({
                  type: err2 ? "error" : "info",
                  message: `[applyApplication] manifests apply stdout:\n${stdout2}`,
                });
                log({
                  type: err2 ? "error" : "info",
                  message: `[applyApplication] manifests apply stderr:\n${stderr2}`,
                });
                if (err2) {
                  // Read all manifest files for debugging
                  const manifests: Record<string, string> = {};
                  for (const file of manifestFiles) {
                    const filePath = path.join(appDir, file);
                    if (fs.existsSync(filePath)) {
                      manifests[file] = fs.readFileSync(filePath, "utf8");
                    }
                  }
                  log({
                    type: "error",
                    message: "Failed to apply manifests",
                    meta: err2,
                  });
                  return res.status(500).json({
                    ...formatNotification("Failed to apply manifests", "error"),
                    error: stderr2,
                    output: stdout2,
                    manifests,
                  });
                }
                log({
                  type: "success",
                  message: `Application applied: ${app.name}`,
                });
                res.json({
                  ...formatNotification("Application applied", "success"),
                  output: stdoutNs + stdout2 + stdout + stdout2,
                });
              }
            );
          }
        }
      );
    }
  );
});

export default applyApplication;
