import { Request, Response } from "express";
import Application from "../../models/application.model";
import asyncHandler from "../../utils/handlers/asyncHandler";
import log, { formatNotification } from "../../utils/logging/logger";
import k8sClient from "../../utils/k8s/client";

const LOG_TAIL_COUNT = 200;
const LOG_THROTTLE_MS = 100;

const streamApplicationLogs = asyncHandler(
  async (req: Request, res: Response) => {
    const app = await Application.findById(req.params.id);
    if (!app) {
      log({ type: "error", message: "Application not found" });
      return res
        .status(404)
        .json(formatNotification("Application not found", "error"));
    }

    const namespace = app.namespace || "default";
    log({
      type: "info",
      message: `[streamApplicationLogs] Using namespace: ${namespace}, app: ${app.name}`,
    });

    try {
      // Get all pods for the app using secure Kubernetes client
      const pods = await k8sClient.getPodsInNamespace(namespace);
      const appPods = pods.filter(
        (pod) => pod.metadata?.labels?.app === app.name
      );

      const podNames = appPods
        .map((pod) => pod.metadata?.name)
        .filter(Boolean) as string[];

      log({
        type: podNames.length ? "info" : "error",
        message: `[streamApplicationLogs] Pod names found: ${podNames.join(
          ", "
        )}`,
      });

      if (!podNames.length) {
        log({ type: "error", message: "No pods found" });
        res.status(404).json(formatNotification("No pods found", "error"));
        return;
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      // For each pod, get and stream logs using secure SDK
      const logStreams = podNames.map(async (podName) => {
        try {
          const logs = await k8sClient.getPodLogs(podName, namespace);
          const lines = logs.split("\n").slice(-LOG_TAIL_COUNT); // Get last N lines

          for (const line of lines) {
            if (line.trim()) {
              const timestamp = new Date().toISOString();
              res.write(`data: ${timestamp} [${podName}] ${line}\n\n`);
            }
          }
        } catch (error) {
          const timestamp = new Date().toISOString();
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";
          res.write(
            `data: ${timestamp} [${podName}] [Error getting logs: ${errorMsg}]\n\n`
          );
        }
      });

      // Wait for all log streams to complete
      await Promise.allSettled(logStreams);

      // End the stream
      const timestamp = new Date().toISOString();
      res.write(`event: end\ndata: ${timestamp} [log stream ended]\n\n`);
      res.end();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      log({
        type: "error",
        message: `Failed to get application logs: ${errorMsg}`,
      });
      res.status(500).json(formatNotification("Failed to get logs", "error"));
    }
  }
);

export default streamApplicationLogs;
