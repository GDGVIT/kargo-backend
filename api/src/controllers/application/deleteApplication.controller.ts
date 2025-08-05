import { Request, Response } from "express";
import Application from "../../models/application.model";
import asyncHandler from "../../utils/handlers/asyncHandler";
import log, { formatNotification } from "../../utils/logging/logger";
import fs from "fs";
import path from "path";
import env from "../../config/env";
import k8sClient from "../../utils/k8s/client";

// Helper to stream progress
function streamStep(
  res: Response,
  message: string,
  status: string = "progress"
) {
  res.write(`data: ${JSON.stringify({ message, status })}\n\n`);
}

const deleteApplication = asyncHandler(async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const app = await Application.findById(req.params.id);
  if (!app) {
    streamStep(res, "Application not found", "error");
    res.end();
    return;
  }
  const namespace = app.namespace || "default";
  const name = app.name;
  const deployment = app.deploymentName || name;
  const service = app.serviceName || name;
  const userId = (app.owner as any)?.toString?.() || app.owner;
  const appId = (app._id as any)?.toString?.() || app._id;
  const manifestsDir = env.MANIFESTS_DIR;
  const appDir = manifestsDir ? path.join(manifestsDir, userId, appId) : null;

  // Helper to safely delete a Kubernetes resource using SDK
  async function deleteK8sResource(
    deleteFunction: () => Promise<any>,
    resourceName: string,
    stepMsg: string
  ): Promise<void> {
    try {
      streamStep(res, stepMsg);
      await deleteFunction();
      streamStep(res, `Successfully deleted ${resourceName}`);
    } catch (error: any) {
      // Log warning but don't fail - resource might not exist
      const message = error.message || `Failed to delete ${resourceName}`;
      streamStep(res, message, "warning");
    }
  }

  let errorOccurred = false;
  let errorMsg = "";

  try {
    if (namespace !== "default") {
      // Delete namespace (removes all resources inside) - SECURE SDK
      try {
        streamStep(res, `Deleting namespace: ${namespace}`);
        const result = await k8sClient.deleteNamespace(namespace);
        streamStep(res, result.message);
      } catch (err: any) {
        errorOccurred = true;
        errorMsg = err.message || `Failed to delete namespace: ${namespace}`;
        streamStep(res, errorMsg, "error");
      }
    } else {
      // Delete individual resources in default namespace using SECURE SDK
      
      // Delete deployment
      await deleteK8sResource(
        () => k8sClient.deleteResourceByNameAndKind(`${deployment}-deployment`, 'Deployment', namespace),
        'deployment',
        `Deleting deployment: ${deployment}-deployment`
      );
      
      // Delete service
      await deleteK8sResource(
        () => k8sClient.deleteResourceByNameAndKind(`${service}-service`, 'Service', namespace),
        'service',
        `Deleting service: ${service}-service`
      );
      
      // Delete ingress
      await deleteK8sResource(
        () => k8sClient.deleteResourceByNameAndKind(`${name}-ingress`, 'Ingress', namespace),
        'ingress',
        `Deleting ingress: ${name}-ingress`
      );
      
      // Delete secret
      await deleteK8sResource(
        () => k8sClient.deleteResourceByNameAndKind(`${name}-env-secret`, 'Secret', namespace),
        'secret',
        `Deleting secret: ${name}-env-secret`
      );
      
      // Delete image pull secret
      await deleteK8sResource(
        () => k8sClient.deleteResourceByNameAndKind(`${name}-regcred`, 'Secret', namespace),
        'image pull secret',
        `Deleting image pull secret: ${name}-regcred`
      );
      
      // Delete PVCs and PVs (auto-generated volume)
      const autoVolumeName = `${name}-data`;
      await deleteK8sResource(
        () => k8sClient.deleteResourceByNameAndKind(`${autoVolumeName}-pvc`, 'PersistentVolumeClaim', namespace),
        'PVC',
        `Deleting PVC: ${autoVolumeName}-pvc`
      );
      
      await deleteK8sResource(
        () => k8sClient.deleteResourceByNameAndKind(`${autoVolumeName}-pv`, 'PersistentVolume'),
        'PV',
        `Deleting PV: ${autoVolumeName}-pv`
      );
    }
  } catch (err: any) {
    errorOccurred = true;
    errorMsg = err.message || "Failed to delete application resources";
    streamStep(res, errorMsg, "error");
  }

  // Always attempt to remove manifests and DB record
  try {
    if (appDir && fs.existsSync(appDir)) {
      const { rimraf } = await import("rimraf");
      await rimraf(appDir);
      streamStep(res, `Deleted manifests directory: ${appDir}`);
    }
  } catch (err: any) {
    streamStep(
      res,
      err.message || `Failed to delete manifests directory: ${appDir}`,
      "warning"
    );
  }

  try {
    await Application.findByIdAndDelete(app._id);
    streamStep(res, "Application removed from database", "success");
  } catch (err: any) {
    streamStep(
      res,
      err.message || "Failed to remove application from database",
      "error"
    );
    errorOccurred = true;
  }

  if (!errorOccurred) {
    streamStep(res, "Application and all resources deleted", "success");
  }
  res.end();
});

export default deleteApplication;
