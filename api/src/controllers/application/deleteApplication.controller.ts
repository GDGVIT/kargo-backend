import { Request, Response } from 'express';
import Application from '../../models/application.model';
import asyncHandler from '../../utils/handlers/asyncHandler';
import log, { formatNotification } from '../../utils/logging/logger';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import env from '../../config/env';

// Helper to stream progress
function streamStep(res: Response, message: string, status: string = 'progress') {
  res.write(`data: ${JSON.stringify({ message, status })}\n\n`);
}

const deleteApplication = asyncHandler(async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const app = await Application.findById(req.params.id);
  if (!app) {
    streamStep(res, 'Application not found', 'error');
    res.end();
    return;
  }
  const namespace = app.namespace || 'default';
  const name = app.name;
  const deployment = app.deploymentName || name;
  const service = app.serviceName || name;
  const userId = (app.owner as any)?.toString?.() || app.owner;
  const appId = (app._id as any)?.toString?.() || app._id;
  const manifestsDir = env.MANIFESTS_DIR;
  const appDir = manifestsDir ? path.join(manifestsDir, userId, appId) : null;

  // Helper to run a kubectl command and stream output
  function runKubectl(args: string[], stepMsg: string): Promise<void> {
    return new Promise((resolve, reject) => {
      streamStep(res, stepMsg);
      const proc = spawn('kubectl', args);
      proc.stdout.on('data', (data) => {
        streamStep(res, data.toString().trim());
      });
      proc.stderr.on('data', (data) => {
        streamStep(res, data.toString().trim(), 'warning');
      });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${stepMsg} failed with code ${code}`));
      });
    });
  }

  let errorOccurred = false;
  let errorMsg = '';

  try {
    if (namespace !== 'default') {
      // Delete namespace (removes all resources inside)
      try {
        await runKubectl(['delete', 'namespace', namespace], `Deleting namespace: ${namespace}`);
      } catch (err: any) {
        errorOccurred = true;
        errorMsg = err.message || `Failed to delete namespace: ${namespace}`;
        streamStep(res, errorMsg, 'error');
      }
    } else {
      // Delete individual resources in default namespace
      // Delete deployment
      try {
        await runKubectl(
          ['delete', 'deployment', `${deployment}-deployment`, '-n', namespace],
          `Deleting deployment: ${deployment}-deployment`
        );
      } catch (err: any) {
        streamStep(res, err.message || `Failed to delete deployment`, 'warning');
      }
      // Delete service
      try {
        await runKubectl(
          ['delete', 'service', `${service}-service`, '-n', namespace],
          `Deleting service: ${service}-service`
        );
      } catch (err: any) {
        streamStep(res, err.message || `Failed to delete service`, 'warning');
      }
      // Delete ingress
      try {
        await runKubectl(
          ['delete', 'ingress', `${name}-ingress`, '-n', namespace],
          `Deleting ingress: ${name}-ingress`
        );
      } catch (err: any) {
        streamStep(res, err.message || `Failed to delete ingress`, 'warning');
      }
      // Delete secret
      try {
        await runKubectl(
          ['delete', 'secret', `${name}-env-secret`, '-n', namespace],
          `Deleting secret: ${name}-env-secret`
        );
      } catch (err: any) {
        streamStep(res, err.message || `Failed to delete secret`, 'warning');
      }
      // Delete image pull secret
      try {
        await runKubectl(
          ['delete', 'secret', `${name}-regcred`, '-n', namespace],
          `Deleting image pull secret: ${name}-regcred`
        );
      } catch (err: any) {
        streamStep(res, err.message || `Failed to delete image pull secret`, 'warning');
      }
      // Delete PVCs and PVs (auto-generated volume)
      const autoVolumeName = `${name}-data`;
      try {
        await runKubectl(
          ['delete', 'pvc', `${autoVolumeName}-pvc`, '-n', namespace],
          `Deleting PVC: ${autoVolumeName}-pvc`
        );
      } catch (err: any) {
        streamStep(res, err.message || `Failed to delete PVC`, 'warning');
      }
      try {
        await runKubectl(
          ['delete', 'pv', `${autoVolumeName}-pv`],
          `Deleting PV: ${autoVolumeName}-pv`
        );
      } catch (err: any) {
        streamStep(res, err.message || `Failed to delete PV`, 'warning');
      }
    }
  } catch (err: any) {
    errorOccurred = true;
    errorMsg = err.message || 'Failed to delete application resources';
    streamStep(res, errorMsg, 'error');
  }

  // Always attempt to remove manifests and DB record
  try {
    if (appDir && fs.existsSync(appDir)) {
      const { rimraf } = await import('rimraf');
      await rimraf(appDir);
      streamStep(res, `Deleted manifests directory: ${appDir}`);
    }
  } catch (err: any) {
    streamStep(res, err.message || `Failed to delete manifests directory: ${appDir}`, 'warning');
  }

  try {
    await Application.findByIdAndDelete(app._id);
    streamStep(res, 'Application removed from database', 'success');
  } catch (err: any) {
    streamStep(res, err.message || 'Failed to remove application from database', 'error');
    errorOccurred = true;
  }

  if (!errorOccurred) {
    streamStep(res, 'Application and all resources deleted', 'success');
  }
  res.end();
});

export default deleteApplication;
