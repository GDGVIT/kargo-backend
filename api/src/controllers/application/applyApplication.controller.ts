import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import Application from "../../models/application.model";
import asyncHandler from "../../utils/handlers/asyncHandler";
import generateK8sManifests from "../../utils/k8s/k8sManifests";
import log, { formatNotification } from "../../utils/logging/logger";
import type IApplication from "../../types/application.types";
import type { Document } from "mongoose";
import env from "../../config/env";

const exec = promisify(execCb);

function writeManifestFiles(
  appDir: string,
  manifests: Record<string, string | undefined>
) {
  for (const [filename, content] of Object.entries(manifests)) {
    if (content) {
      fs.writeFileSync(path.join(appDir, filename), content);
    }
  }
}

async function applyManifestSequence(
  appDir: string,
  appName: string,
  manifestFiles: string[],
  res: Response
) {
  try {
    // Apply namespace first
    await exec(`kubectl apply -f namespace.yaml`, { cwd: appDir });

    // Apply PVs first if present
    if (fs.existsSync(path.join(appDir, "pvs.yaml"))) {
      await exec(`kubectl apply -f pvs.yaml`, { cwd: appDir });
    }

    // Apply PVCs next if present
    if (fs.existsSync(path.join(appDir, "pvcs.yaml"))) {
      await exec(`kubectl apply -f pvcs.yaml`, { cwd: appDir });
    }

    await exec(`kubectl apply -f secret.yaml`, { cwd: appDir });
    if (fs.existsSync(path.join(appDir, "imagepullsecret.yaml"))) {
      await exec(`kubectl apply -f imagepullsecret.yaml`, { cwd: appDir });
    }
    const { stdout } = await exec(
      `kubectl apply -f . --prune -l app=${appName} --field-manager=application-controller`,
      { cwd: appDir }
    );
    log({ type: "success", message: `Application applied: ${appName}` });
    res.json({
      ...formatNotification("Application applied", "success"),
      output: stdout,
    });
  } catch (err: any) {
    log({ type: "error", message: "Failed to apply manifests", meta: err });
    // Read all manifest files for debugging
    const manifests: Record<string, string> = {};
    for (const file of manifestFiles) {
      const filePath = path.join(appDir, file);
      if (fs.existsSync(filePath)) {
        manifests[file] = fs.readFileSync(filePath, "utf8");
      }
    }
    res.status(500).json({
      ...formatNotification("Failed to apply manifests", "error"),
      error: err.stderr || err.message,
      manifests,
    });
  }
}

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

  const manifestsResult = generateK8sManifests(app);
  const {
    deployment: deploymentYaml,
    service: serviceYaml,
    ingress: ingressYaml,
    secret: secretYaml,
    imagepullsecret: imagePullSecretYaml,
    pvcs: pvcsYaml,
  } = manifestsResult;

  if (!app.namespace) {
    log({ type: "error", message: "Application namespace is undefined" });
    return res
      .status(500)
      .json(formatNotification("Application namespace is undefined", "error"));
  }

  const manifests: Record<string, string | undefined> = {
    "namespace.yaml": `apiVersion: v1\nkind: Namespace\nmetadata:\n  name: ${app.namespace}\n`,
    "secret.yaml": secretYaml,
    "imagepullsecret.yaml": imagePullSecretYaml,
    "deployment.yaml": deploymentYaml,
    "service.yaml": serviceYaml,
    "ingress.yaml": ingressYaml,
    "pvcs.yaml": pvcsYaml,
  };

  writeManifestFiles(appDir, manifests);

  const manifestFiles = Object.keys(manifests).filter((f) => manifests[f]);
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

  // Apply namespace first
  await exec(`kubectl apply -f namespace.yaml`, { cwd: appDir });

  // Apply PVs first if present
  if (manifestsResult.pvs) {
    fs.writeFileSync(path.join(appDir, "pvs.yaml"), manifestsResult.pvs);
    await exec(`kubectl apply -f pvs.yaml`, { cwd: appDir });
  }

  // Apply PVCs next if present
  if (pvcsYaml) {
    await exec(`kubectl apply -f pvcs.yaml`, { cwd: appDir });
  }

  // Now apply the rest (deployment, service, ingress, secrets, etc.)
  await applyManifestSequence(appDir, app.name, manifestFiles, res);
});

export default applyApplication;
