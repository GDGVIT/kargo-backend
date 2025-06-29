import { Request, Response } from "express";
import { spawn } from "child_process";
import Application from "../../models/application.model";
import asyncHandler from "../../utils/handlers/asyncHandler";
import log, { formatNotification } from "../../utils/logging/logger";

const getApplicationMetrics = asyncHandler(
  async (req: Request, res: Response) => {
    const app = await Application.findById(req.params.id);
    if (!app) {
      log({ type: "error", message: "Application not found" });
      return res
        .status(404)
        .json(formatNotification("Application not found", "error"));
    }
    const namespace = app.namespace || "default";
    const deploymentLabel = app.deploymentName
      ? `deployment=${app.deploymentName}`
      : `app=${app.name}`;

    // Use kubectl get --raw to fetch metrics from metrics-server
    const kubectl = spawn("kubectl", [
      "get",
      "--raw",
      `/apis/metrics.k8s.io/v1beta1/namespaces/${namespace}/pods`,
    ]);
    let output = "";
    let error = "";
    kubectl.stdout.on("data", (data: Buffer) => {
      output += data.toString();
    });
    kubectl.stderr.on("data", (data: Buffer) => {
      error += data.toString();
    });
    kubectl.on("close", async (code: number) => {
      if (code !== 0 || error) {
        log({ type: "error", message: `kubectl metrics API failed: ${error}` });
        return res
          .status(500)
          .json(formatNotification("Failed to fetch metrics", "error"));
      }
      try {
        const data = JSON.parse(output);
        // Filter pods by label
        const pods = (data.items || []).filter((pod: any) => {
          const labels = pod.metadata?.labels || {};
          if (app.deploymentName) {
            return labels["deployment"] === app.deploymentName;
          } else {
            return labels["app"] === app.name;
          }
        });
        const metrics = pods.map((pod: any) => {
          const podName = pod.metadata.name;
          const containers =
            pod.containers || pod.usage || pod.containers || [];
          let cpuMilli = 0,
            memoryMB = 0,
            storageGB = 0;
          containers.forEach((c: any) => {
            // CPU in n (nano cores), convert to m (millicores)
            if (c.usage?.cpu) {
              const cpuStr = c.usage.cpu;
              if (cpuStr.endsWith("n")) {
                cpuMilli += Math.round(parseInt(cpuStr) / 1000000);
              } else if (cpuStr.endsWith("m")) {
                cpuMilli += parseInt(cpuStr);
              } else if (cpuStr.endsWith("")) {
                cpuMilli += parseInt(cpuStr) * 1000;
              }
            }
            // Memory in bytes, Ki, Mi, Gi
            if (c.usage?.memory) {
              const memStr = c.usage.memory;
              if (memStr.endsWith("Ki")) {
                memoryMB += Math.round(parseInt(memStr) / 1024);
              } else if (memStr.endsWith("Mi")) {
                memoryMB += parseInt(memStr);
              } else if (memStr.endsWith("Gi")) {
                memoryMB += parseInt(memStr) * 1024;
              } else if (/^\d+$/.test(memStr)) {
                memoryMB += Math.round(parseInt(memStr) / (1024 * 1024));
              }
            }
            // Ephemeral storage (if available)
            if (c.usage?.["ephemeral-storage"]) {
              const storageStr = c.usage["ephemeral-storage"];
              if (storageStr.endsWith("Ki")) {
                storageGB += Math.round(parseInt(storageStr) / 1024);
              } else if (storageStr.endsWith("Mi")) {
                storageGB += parseInt(storageStr);
              } else if (storageStr.endsWith("Gi")) {
                storageGB += parseInt(storageStr) * 1024;
              } else if (/^\d+$/.test(storageStr)) {
                storageGB += Math.round(parseInt(storageStr) / (1024 * 1024));
              }
            }
          });
          return { pod: podName, cpuMilli, memoryMB, storageGB };
        });
        // Return metrics and resource requests/limits
        res.json({
          metrics,
          resources: {
            requests: {
              cpuMilli: app.resources?.requests?.cpuMilli || null,
              memoryMB: app.resources?.requests?.memoryMB || null,
              storageGB: app.resources?.requests?.storageGB || null,
            },
            limits: {
              cpuMilli: app.resources?.limits?.cpuMilli || null,
              memoryMB: app.resources?.limits?.memoryMB || null,
              storageGB: app.resources?.limits?.storageGB || null,
            },
          },
        });
      } catch (e) {
        log({ type: "error", message: `Failed to parse metrics: ${e}` });
        return res
          .status(500)
          .json(formatNotification("Failed to parse metrics", "error"));
      }
    });
  }
);

export default getApplicationMetrics;
