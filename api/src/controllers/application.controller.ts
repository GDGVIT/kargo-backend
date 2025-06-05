import { Request, Response } from "express";
import Application from "../models/application.model";
import { asyncHandler } from "../utils/asyncHandler";

// Utility to format names for k8s resources
function formatK8sName(base: string) {
  return base
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}

// Utility to generate namespace per user and app
function getNamespace(userId: string, appName: string) {
  return `ns-${formatK8sName(userId)}-${formatK8sName(appName)}`;
}

// Utility to generate resource names
function getResourceName(type: string, appName: string) {
  return `${type}-${formatK8sName(appName)}`;
}

// Create Application
export const createApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      name,
      imageUrl,
      imageTag,
      registryToken,
      env,
      resources,
      ports,
      volumes,
      ingress,
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
    const secretName = getResourceName("secret", name);
    // Optionally format ingress name/host if needed
    const ingressHost =
      ingress?.host || `${formatK8sName(name)}.apps.kargo.local`;

    const app = await Application.create({
      name,
      imageUrl,
      imageTag,
      registryToken,
      namespace,
      deploymentName,
      serviceName,
      ingressHost,
      env,
      resources,
      ports,
      volumes,
      ingress,
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

// Get All Applications for User
export const getApplications = asyncHandler(
  async (req: Request, res: Response) => {
    const owner = (req.user as any)?._id || req.query.owner;
    const apps = await Application.find({ owner });
    res.json({ applications: apps });
  }
);

// Get Single Application
export const getApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ message: "Application not found" });
    res.json({ application: app });
  }
);

// Update Application
export const updateApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      name,
      env,
      resources,
      ports,
      volumes,
      ingress,
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
    const secretName = getResourceName("secret", name);
    const ingressHost =
      ingress?.host || `${formatK8sName(name)}.apps.kargo.local`;

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
        ingressHost,
        env,
        resources,
        ports,
        volumes,
        ingress,
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

// Delete Application
export const deleteApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const app = await Application.findByIdAndDelete(req.params.id);
    if (!app) return res.status(404).json({ message: "Application not found" });
    res.json({ message: "Application deleted" });
  }
);
