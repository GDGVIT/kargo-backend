import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { exec, spawn } from "child_process";
import Application from "../models/application.model";
import { asyncHandler } from "../utils/asyncHandler";
import {
  generateK8sManifests,
  generateRoleBindingYaml,
} from "../utils/k8sManifests";
import {
  formatK8sName,
  getNamespace,
  getResourceName,
  getBaseDomain,
} from "../utils/k8sHelpers";
import { mapPorts } from "../utils/portHelpers";
import { checkResourceQuota } from "../utils/resourceQuota";

export const createApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      name,
      imageUrl,
      imageTag,
      registryToken,
      env: envVars,
      resources,
      ports = [],
      volumes,
      livenessProbe,
      readinessProbe,
      command,
      args,
      labels,
      annotations,
      tolerations,
      affinity,
    } = req.body;
    const owner = (req.user as any)?._id || req.body.owner;
    const namespace = getNamespace(owner.toString(), name);
    const deploymentName = getResourceName("deploy", name);
    const serviceName = getResourceName("svc", name);

    const username = (req.user as any)?.username || req.body.username || "user";
    const updatedPorts = mapPorts(ports, username);

    const app = await Application.create({
      name,
      imageUrl,
      imageTag,
      registryToken,
      namespace,
      deploymentName,
      serviceName,
      env: envVars,
      resources,
      ports: updatedPorts,
      volumes,
      livenessProbe,
      readinessProbe,
      command,
      args,
      labels,
      annotations,
      nodeSelector: req.body.nodeSelector,
      tolerations,
      affinity,
      owner,
    });
    res.status(201).json({ application: app });
  }
);

export const getApplications = asyncHandler(
  async (req: Request, res: Response) => {
    const owner = (req.user as any)?._id || req.query.owner;
    const apps = await Application.find({ owner });
    res.json({ applications: apps });
  }
);

export const getApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ message: "Application not found" });
    res.json({ application: app });
  }
);

export const updateApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      name,
      env: envVars,
      resources,
      ports = [],
      volumes,
      livenessProbe,
      readinessProbe,
      command,
      args,
      labels,
      annotations,
      tolerations,
      affinity,
    } = req.body;
    const owner = (req.user as any)?._id || req.body.owner;
    const namespace = getNamespace(owner.toString(), name);
    const deploymentName = getResourceName("deploy", name);
    const serviceName = getResourceName("svc", name);

    const username = (req.user as any)?.username || req.body.username || "user";
    const updatedPorts = mapPorts(ports, username);

    if (resources) {
      const quota = await checkResourceQuota({ resources, owner, req });
      if (quota.exceeded) {
        return res.status(400).json({
          message: "Resource allocation exceeds your allowed quota.",
          allowed: quota.allowed,
          usage: quota.usage,
        });
      }
    }

    const app = await Application.findByIdAndUpdate(
      req.params.id,
      {
        name,
        imageUrl: req.body.imageUrl,
        imageTag: req.body.imageTag,
        registryToken: req.body.registryToken,
        namespace,
        deploymentName,
        serviceName,
        env: envVars,
        resources,
        ports: updatedPorts,
        volumes,
        livenessProbe,
        readinessProbe,
        command,
        args,
        labels,
        annotations,
        nodeSelector: req.body.nodeSelector,
        tolerations,
        affinity,
        owner,
      },
      { new: true }
    );
    if (!app) return res.status(404).json({ message: "Application not found" });
    res.json({ application: app });
  }
);

export const deleteApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const app = await Application.findByIdAndDelete(req.params.id);
    if (!app) return res.status(404).json({ message: "Application not found" });
    res.json({ message: "Application deleted" });
  }
);

export const applyApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ message: "Application not found" });
    const userId = (app.owner as any).toString();
    const appId = (app._id as any).toString();
    const manifestsDir = process.env.MANIFESTS_DIR;
    if (!manifestsDir)
      return res.status(500).json({ message: "MANIFESTS_DIR not set in env" });
    const appDir = path.join(manifestsDir, userId, appId);

    if (fs.existsSync(appDir)) {
      fs.rmSync(appDir, { recursive: true, force: true });
    }
    fs.mkdirSync(appDir, { recursive: true });

    const { deploymentYaml, serviceYaml, ingressYaml, secretYaml } =
      generateK8sManifests(app);
    if (!app.namespace) {
      return res
        .status(500)
        .json({ message: "Application namespace is undefined" });
    }
    const roleBindingYaml = generateRoleBindingYaml(app.namespace);

    // Log manifest directory and file paths
    console.log("[applyApplication] appDir:", appDir);

    fs.writeFileSync(
      path.join(appDir, "namespace.yaml"),
      `apiVersion: v1\nkind: Namespace\nmetadata:\n  name: ${app.namespace}\n`
    );
    fs.writeFileSync(path.join(appDir, "secret.yaml"), secretYaml || "");
    fs.writeFileSync(path.join(appDir, "deployment.yaml"), deploymentYaml);
    fs.writeFileSync(path.join(appDir, "service.yaml"), serviceYaml);
    if (ingressYaml)
      fs.writeFileSync(path.join(appDir, "ingress.yaml"), ingressYaml);
    fs.writeFileSync(path.join(appDir, "rolebinding.yaml"), roleBindingYaml);

    // Log manifest contents
    const manifestFiles = [
      "namespace.yaml",
      "rolebinding.yaml",
      "secret.yaml",
      "deployment.yaml",
      "service.yaml",
      "ingress.yaml",
    ];
    for (const file of manifestFiles) {
      const filePath = path.join(appDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf8");
        console.log(`[applyApplication] ${file} content:\n`, content);
      }
    }

    // Apply namespace first, then RoleBinding, then secret, then the rest
    exec(
      `kubectl apply -f namespace.yaml`,
      { cwd: appDir },
      (errNs, stdoutNs, stderrNs) => {
        console.log("[applyApplication] namespace apply stdout:\n", stdoutNs);
        console.log("[applyApplication] namespace apply stderr:\n", stderrNs);
        if (errNs) {
          console.error("[applyApplication] namespace apply error:", errNs);
          return res
            .status(500)
            .json({ message: "Failed to apply namespace", error: stderrNs });
        }

        exec(
          `kubectl apply -f secret.yaml`,
          { cwd: appDir },
          (err, stdout, stderr) => {
            console.log("[applyApplication] secret apply stdout:\n", stdout);
            console.log("[applyApplication] secret apply stderr:\n", stderr);
            if (err) {
              const secretContent = fs.readFileSync(
                path.join(appDir, "secret.yaml"),
                "utf8"
              );
              console.error("[applyApplication] secret apply error:", err);
              console.error(
                "[applyApplication] secret manifest content:\n",
                secretContent
              );
              return res.status(500).json({
                message: "Failed to apply secret",
                error: stderr,
                secret: secretContent,
              });
            }
            exec(
              `kubectl apply -f . --prune -l app=${app.name} --field-manager=application-controller`,
              { cwd: appDir },
              (err2, stdout2, stderr2) => {
                console.log(
                  "[applyApplication] manifests apply stdout:\n",
                  stdout2
                );
                console.log(
                  "[applyApplication] manifests apply stderr:\n",
                  stderr2
                );
                if (err2) {
                  // Read all manifest files for debugging
                  const manifests: Record<string, string> = {};
                  for (const file of manifestFiles) {
                    const filePath = path.join(appDir, file);
                    if (fs.existsSync(filePath)) {
                      manifests[file] = fs.readFileSync(filePath, "utf8");
                    }
                  }
                  console.error(
                    "[applyApplication] manifests apply error:",
                    err2
                  );
                  return res.status(500).json({
                    message: "Failed to apply manifests",
                    error: stderr2,
                    output: stdout2,
                    manifests,
                  });
                }
                res.json({
                  message: "Application applied",
                  output: stdoutNs + stdout2 + stdout + stdout2,
                });
              }
            );
          }
        );
      }
    );
  }
);

export const removeDeployment = asyncHandler(
  async (req: Request, res: Response) => {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ message: "Application not found" });
    const userId = (app.owner as any).toString();
    const appId = (app._id as any).toString();
    const manifestsDir = process.env.MANIFESTS_DIR;
    if (!manifestsDir)
      return res.status(500).json({ message: "MANIFESTS_DIR not set in env" });
    const appDir = path.join(manifestsDir, userId, appId);
    exec(`kubectl delete -f .`, { cwd: appDir }, (err, stdout, stderr) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Failed to remove deployment", error: stderr });
      }
      res.json({ message: "Deployment removed", output: stdout });
    });
  }
);

export const removeNamespace = asyncHandler(
  async (req: Request, res: Response) => {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ message: "Application not found" });
    const namespace = app.namespace;
    exec(`kubectl delete namespace ${namespace}`, (err, stdout, stderr) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Failed to remove namespace", error: stderr });
      }
      res.json({ message: "Namespace removed", output: stdout });
    });
  }
);

export const deleteApplicationAndResources = asyncHandler(
  async (req: Request, res: Response) => {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ message: "Application not found" });

    const namespace = app.namespace;
    const userId = (app.owner as any).toString();
    const appId = (app._id as any).toString();
    const manifestsDir = process.env.MANIFESTS_DIR;
    const appDir = manifestsDir ? path.join(manifestsDir, userId, appId) : null;

    // Delete namespace and all resources in it
    await new Promise<void>((resolve, reject) => {
      exec(`kubectl delete namespace ${namespace}`, (err, stdout, stderr) => {
        if (err && !(stderr && stderr.includes("not found"))) {
          return reject(stderr);
        }
        resolve();
      });
    });

    // Remove manifests folder
    if (appDir && fs.existsSync(appDir)) {
      const { rimraf } = await import("rimraf");
      await rimraf(appDir);
    }

    // Remove from DB
    await Application.findByIdAndDelete(req.params.id);

    res.json({ message: "Application and all resources deleted" });
  }
);

export const streamApplicationLogs = asyncHandler(
  async (req: Request, res: Response) => {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ message: "Application not found" });
    const namespace = app.namespace;
    // Get pod name by label selector (assume 1 pod per deployment)
    console.log(
      "[streamApplicationLogs] Using namespace:",
      namespace,
      "app:",
      app.name
    );
    const getPod = spawn(
      "kubectl",
      [
        "get",
        "pods",
        "-n",
        namespace ?? "default",
        "-l",
        `app=${app.name}`,
        "-o",
        "jsonpath={.items[0].metadata.name}",
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let podName = "";
    (getPod.stdout as NodeJS.ReadableStream).on("data", (data: Buffer) => {
      podName += data.toString();
    });
    (getPod.stderr as NodeJS.ReadableStream).on("data", (data: Buffer) => {
      console.error("[streamApplicationLogs] getPod stderr:", data.toString());
    });
    getPod.on("close", (_code: number) => {
      console.log("[streamApplicationLogs] Pod name found:", podName);
      if (!podName) {
        res.status(404).json({ message: "Pod not found" });
        return;
      }
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      const logs = spawn(
        "kubectl",
        ["logs", podName, "-n", namespace ?? "default", "-f"],
        { stdio: ["ignore", "pipe", "pipe"] }
      );
      (logs.stdout as NodeJS.ReadableStream).on("data", (data: Buffer) => {
        res.write(`data: ${data.toString().replace(/\n/g, "\ndata: ")}\n\n`);
      });
      (logs.stderr as NodeJS.ReadableStream).on("data", (data: Buffer) => {
        console.error("[streamApplicationLogs] logs stderr:", data.toString());
        res.write(
          `data: [stderr] ${data.toString().replace(/\n/g, "\ndata: ")}\n\n`
        );
      });
      logs.on("close", () => {
        res.write("event: end\ndata: [log stream ended]\n\n");
        res.end();
      });
      req.on("close", () => {
        logs.kill();
      });
    });
  }
);
