import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { exec, spawn } from "child_process";
import Application from "../models/application.model";
import { asyncHandler } from "../utils/asyncHandler";
import { generateK8sManifests } from "../utils/k8sManifests";
import {
  formatK8sName,
  getNamespace,
  getResourceName,
  getBaseDomain,
} from "../utils/k8sHelpers";
import { mapPorts } from "../utils/portHelpers";
import { checkResourceQuota } from "../utils/resourceQuota";
import { runDockerScript } from "../utils/docker-file";
import { log, formatNotification } from "../utils/logger";

export const createApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      name,
      imageUrl,
      imageTag,
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
    const credentials = req.body.credentials || [];
    const owner = (req.user as any)?._id || req.body.owner;
    const namespace = getNamespace(owner.toString(), name);
    const deploymentName = getResourceName("deploy", name);
    const serviceName = getResourceName("svc", name);

    const username = (req.user as any)?.username || req.body.username || "user";
    const updatedPorts = mapPorts(ports, username);

    try {
      const app = await Application.create({
        name,
        imageUrl,
        imageTag,
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
        credentials,
      });
      log({ type: "success", message: `Application created: ${name}` });
      res.status(201).json({
        ...formatNotification("Application created", "success"),
        application: app,
      });
    } catch (err) {
      log({
        type: "error",
        message: "Failed to create application",
        meta: err,
      });
      res
        .status(500)
        .json(formatNotification("Failed to create application", "error"));
    }
  }
);

export const getApplications = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const owner = (req.user as any)?._id || req.query.owner;
      const apps = await Application.find({ owner });
      log({
        type: "info",
        message: `Fetched applications for owner: ${owner}`,
      });
      res.json({
        ...formatNotification("Fetched applications", "info"),
        applications: apps,
      });
    } catch (err) {
      log({
        type: "error",
        message: "Failed to fetch applications",
        meta: err,
      });
      res
        .status(500)
        .json(formatNotification("Failed to fetch applications", "error"));
    }
  }
);

export const getApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const app = await Application.findById(req.params.id);
    if (!app) {
      log({ type: "error", message: "Application not found" });
      return res
        .status(404)
        .json(formatNotification("Application not found", "error"));
    }
    log({ type: "info", message: `Fetched application: ${app.name}` });
    res.json({
      ...formatNotification("Fetched application", "info"),
      application: app,
    });
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
    const credentials = req.body.credentials || [];
    const owner = (req.user as any)?._id || req.body.owner;
    const namespace = getNamespace(owner.toString(), name);
    const deploymentName = getResourceName("deploy", name);
    const serviceName = getResourceName("svc", name);

    const username = (req.user as any)?.username || req.body.username || "user";
    const updatedPorts = mapPorts(ports, username);

    try {
      if (resources) {
        const quota = await checkResourceQuota({ resources, owner, req });
        if (quota.exceeded) {
          log({
            type: "warning",
            message: "Resource allocation exceeds allowed quota.",
          });
          return res.status(400).json({
            ...formatNotification(
              "Resource allocation exceeds your allowed quota.",
              "warning"
            ),
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
          credentials,
        },
        { new: true }
      );
      if (!app) {
        log({ type: "error", message: "Application not found" });
        return res
          .status(404)
          .json(formatNotification("Application not found", "error"));
      }
      log({ type: "success", message: `Application updated: ${app.name}` });
      res.json({
        ...formatNotification("Application updated", "success"),
        application: app,
      });
    } catch (err) {
      log({
        type: "error",
        message: "Failed to update application",
        meta: err,
      });
      res
        .status(500)
        .json(formatNotification("Failed to update application", "error"));
    }
  }
);

export const deleteApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const app = await Application.findByIdAndDelete(req.params.id);
    if (!app) {
      log({ type: "error", message: "Application not found" });
      return res
        .status(404)
        .json(formatNotification("Application not found", "error"));
    }
    log({ type: "success", message: `Application deleted: ${app.name}` });
    res.json(formatNotification("Application deleted", "success"));
  }
);

export const applyApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const app = await Application.findById(req.params.id);
    if (!app) {
      log({ type: "error", message: "Application not found" });
      return res
        .status(404)
        .json(formatNotification("Application not found", "error"));
    }
    const userId = (app.owner as any).toString();
    const appId = (app._id as any).toString();
    const manifestsDir = process.env.MANIFESTS_DIR;
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
        .json(
          formatNotification("Application namespace is undefined", "error")
        );
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
                        output: stdoutNs + stdout2 + stdout + stdout2,
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
                    output: stdoutNs + stdout2 + stdout + stdout2,
                  });
                }
              );
            }
          }
        );
      }
    );
  }
);

export const removeDeployment = asyncHandler(
  async (req: Request, res: Response) => {
    const app = await Application.findById(req.params.id);
    if (!app) {
      log({ type: "error", message: "Application not found" });
      return res
        .status(404)
        .json(formatNotification("Application not found", "error"));
    }
    const userId = (app.owner as any).toString();
    const appId = (app._id as any).toString();
    const manifestsDir = process.env.MANIFESTS_DIR;
    if (!manifestsDir) {
      log({ type: "error", message: "MANIFESTS_DIR not set in env" });
      return res
        .status(500)
        .json(formatNotification("MANIFESTS_DIR not set in env", "error"));
    }
    const appDir = path.join(manifestsDir, userId, appId);
    exec(`kubectl delete -f .`, { cwd: appDir }, (err, stdout, stderr) => {
      if (err) {
        log({
          type: "error",
          message: "Failed to remove deployment",
          meta: err,
        });
        return res.status(500).json({
          ...formatNotification("Failed to remove deployment", "error"),
          error: stderr,
        });
      }
      log({
        type: "success",
        message: `Deployment removed for app: ${app.name}`,
      });
      res.json({
        ...formatNotification("Deployment removed", "success"),
        output: stdout,
      });
    });
  }
);

export const removeNamespace = asyncHandler(
  async (req: Request, res: Response) => {
    const app = await Application.findById(req.params.id);
    if (!app) {
      log({ type: "error", message: "Application not found" });
      return res
        .status(404)
        .json(formatNotification("Application not found", "error"));
    }
    const namespace = app.namespace;
    exec(`kubectl delete namespace ${namespace}`, (err, stdout, stderr) => {
      if (err) {
        log({
          type: "error",
          message: "Failed to remove namespace",
          meta: err,
        });
        return res.status(500).json({
          ...formatNotification("Failed to remove namespace", "error"),
          error: stderr,
        });
      }
      log({ type: "success", message: `Namespace removed: ${namespace}` });
      res.json({
        ...formatNotification("Namespace removed", "success"),
        output: stdout,
      });
    });
  }
);

export const deleteApplicationAndResources = asyncHandler(
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

export const streamApplicationLogs = asyncHandler(
  async (req: Request, res: Response) => {
    const app = await Application.findById(req.params.id);
    if (!app) {
      log({ type: "error", message: "Application not found" });
      return res
        .status(404)
        .json(formatNotification("Application not found", "error"));
    }
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
      log({
        type: "error",
        message: `[streamApplicationLogs] getPod stderr: ${data.toString()}`,
      });
    });
    getPod.on("close", (_code: number) => {
      log({
        type: podName ? "info" : "error",
        message: `[streamApplicationLogs] Pod name found: ${podName}`,
      });
      if (!podName) {
        log({ type: "error", message: "Pod not found" });
        res.status(404).json(formatNotification("Pod not found", "error"));
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
        log({
          type: "error",
          message: `[streamApplicationLogs] logs stderr: ${data.toString()}`,
        });
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

export const runDockerHandler = async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url || typeof url !== "string") {
    log({ type: "error", message: "Missing or invalid 'url' in body." });
    return res
      .status(400)
      .json(formatNotification("Missing or invalid 'url' in body.", "error"));
  }
  try {
    runDockerScript(url).then((result) => {
      if (result.error) {
        log({ type: "error", message: `Docker script error: ${result.error}` });
        return res.status(500).json(formatNotification(result.error, "error"));
      }
      log({
        type: "success",
        message: "Dockerfile and Compose generated successfully",
      });
      res.status(200).json({
        ...formatNotification(
          "Dockerfile and Compose generated successfully",
          "success"
        ),
        dockerfile: result.dockerfile,
        dockerCompose: result.dockerCompose,
      });
    });
  } catch (error: any) {
    log({ type: "error", message: "Python script failed.", meta: error });
    res.status(500).json(formatNotification("Python script failed.", "error"));
  }
};
