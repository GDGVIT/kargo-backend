import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import Application from "../../models/application.model";
import asyncHandler from "../../utils/handlers/asyncHandler";
import generateK8sManifests from "../../utils/k8s/k8sManifests";
import log, { formatNotification } from "../../utils/logging/logger";
import type IApplication from "../../types/application.types";
import type { Document } from "mongoose";
import env from "../../config/env";
import k8sClient from "../../utils/k8s/client";

/**
 * Safely parse and apply YAML content to Kubernetes
 */
async function applyYamlContent(
  yamlContent: string,
  description?: string
): Promise<void> {
  // Skip empty or whitespace-only content
  if (!yamlContent || yamlContent.trim() === "") {
    if (description) {
      log({
        type: "info",
        message: `Skipping empty ${description} - no content to apply`,
      });
    }
    return;
  }

  try {
    // Parse YAML to JavaScript object
    const resource = yaml.load(yamlContent) as any;

    // Skip if parsing resulted in null or empty object
    if (!resource || typeof resource !== "object") {
      if (description) {
        log({
          type: "info",
          message: `Skipping ${description} - no valid resource found`,
        });
      }
      return;
    }

    // Apply the parsed resource
    await k8sClient.applyResource(resource);
  } catch (error) {
    const errorMsg = `Failed to apply ${description || "YAML content"}`;
    log({
      type: "error",
      message: errorMsg,
      meta: { error, content: yamlContent },
    });
    throw new Error(
      `${errorMsg}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

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
    // Apply namespace first using secure Kubernetes client
    const namespaceContent = fs.readFileSync(
      path.join(appDir, "namespace.yaml"),
      "utf8"
    );
    await applyYamlContent(namespaceContent, "namespace");

    // Apply PVs first if present
    if (fs.existsSync(path.join(appDir, "pvs.yaml"))) {
      const pvsContent = fs.readFileSync(path.join(appDir, "pvs.yaml"), "utf8");
      await applyYamlContent(pvsContent, "persistent volumes");
    }

    // Apply PVCs next if present
    if (fs.existsSync(path.join(appDir, "pvcs.yaml"))) {
      const pvcsContent = fs.readFileSync(
        path.join(appDir, "pvcs.yaml"),
        "utf8"
      );
      await applyYamlContent(pvcsContent, "persistent volume claims");
    }

    // Apply secret using secure client
    const secretContent = fs.readFileSync(
      path.join(appDir, "secret.yaml"),
      "utf8"
    );
    await applyYamlContent(secretContent, "secret");

    // Apply image pull secret if present
    if (fs.existsSync(path.join(appDir, "imagepullsecret.yaml"))) {
      const imagePullSecretContent = fs.readFileSync(
        path.join(appDir, "imagepullsecret.yaml"),
        "utf8"
      );
      await applyYamlContent(imagePullSecretContent, "image pull secret");
    }

    // Apply remaining manifests
    const results = [];
    for (const filename of manifestFiles) {
      if (
        filename !== "namespace.yaml" &&
        filename !== "pvs.yaml" &&
        filename !== "pvcs.yaml" &&
        filename !== "secret.yaml" &&
        filename !== "imagepullsecret.yaml"
      ) {
        const filePath = path.join(appDir, filename);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf8");
          await applyYamlContent(content, filename);
          results.push({ file: filename, status: "applied" });
        }
      }
    }

    log({ type: "success", message: `Application applied: ${appName}` });
    res.json({
      ...formatNotification("Application applied", "success"),
      output: `Successfully applied ${results.length} resources`,
      results,
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
      error: err.message,
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
    "deployment.yaml": deploymentYaml,
    "service.yaml": serviceYaml,
    "ingress.yaml": ingressYaml,
    "pvcs.yaml": pvcsYaml,
  };

  // Only add imagepullsecret if it exists
  if (imagePullSecretYaml) {
    manifests["imagepullsecret.yaml"] = imagePullSecretYaml;
  }

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

  // Apply namespace first using secure client
  const namespaceContent = fs.readFileSync(
    path.join(appDir, "namespace.yaml"),
    "utf8"
  );
  await applyYamlContent(namespaceContent, "namespace");

  // Apply PVs first if present
  if (manifestsResult.pvs) {
    fs.writeFileSync(path.join(appDir, "pvs.yaml"), manifestsResult.pvs);
    await applyYamlContent(manifestsResult.pvs, "persistent volumes");
  }

  // Apply PVCs next if present
  if (pvcsYaml) {
    await applyYamlContent(pvcsYaml, "persistent volume claims");
  }

  // Now apply the rest (deployment, service, ingress, secrets, etc.)
  await applyManifestSequence(appDir, app.name, manifestFiles, res);
});

export default applyApplication;
