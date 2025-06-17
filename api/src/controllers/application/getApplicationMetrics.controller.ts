import { Request, Response } from "express";
import { spawn } from "child_process";
import Application from "../../models/application.model";
import { asyncHandler } from "../../utils/handlers/asyncHandler";
import { log, formatNotification } from "../../utils/logging/logger";

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
    const appName = app.name;
    // Use kubectl top pod to get metrics for all pods in the namespace (no label selector)
    const kubectl = spawn("kubectl", [
      "top",
      "pod",
      "-n",
      namespace,
      "--no-headers",
    ]);
    let output = "";
    let error = "";
    kubectl.stdout.on("data", (data: Buffer) => {
      output += data.toString();
    });
    kubectl.stderr.on("data", (data: Buffer) => {
      error += data.toString();
    });
    kubectl.on("close", (code: number) => {
      if (code !== 0 || error) {
        log({ type: "error", message: `kubectl top pod failed: ${error}` });
        return res
          .status(500)
          .json(formatNotification("Failed to fetch metrics", "error"));
      }
      // Parse output: POD_NAME CPU(m) MEMORY(Mi)
      const metrics = output
        .trim()
        .split("\n")
        .map((line) => {
          const [pod, cpu, memory] = line.split(/\s+/);
          return { pod, cpu: parseInt(cpu, 10), memory: parseInt(memory, 10) };
        });
      res.json({ metrics });
    });
  }
);

export default getApplicationMetrics;
