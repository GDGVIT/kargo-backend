import { Request, Response } from "express";
import Application from "../models/application.model";
import { asyncHandler } from "../utils/asyncHandler";

function formatK8sName(base: string) {
  return base
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}

function getNamespace(userId: string, appName: string) {
  return `ns-${formatK8sName(userId)}-${formatK8sName(appName)}`;
}

function getResourceName(type: string, appName: string) {
  return `${type}-${formatK8sName(appName)}`;
}

const INGRESS_BASE_DOMAIN =
  process.env.INGRESS_BASE_DOMAIN || ".apps.kargo.local";

function buildIngressHost({
  name,
  username,
  domainPrefix,
}: {
  name: string;
  username: string;
  domainPrefix?: string;
}) {
  const prefix = domainPrefix ? `${formatK8sName(domainPrefix)}-` : "";
  return `${prefix}${formatK8sName(name)}-${formatK8sName(
    username
  )}-${INGRESS_BASE_DOMAIN}`;
}

function buildSubdomainHost({
  subdomain,
  username,
}: {
  subdomain: string;
  username: string;
}) {
  return `${formatK8sName(subdomain)}-${formatK8sName(
    username
  )}${INGRESS_BASE_DOMAIN}`;
}

export const createApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      name,
      imageUrl,
      imageTag,
      registryToken,
      env: envVars,
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
    const username = (req.user as any)?.username || req.body.username || "user";
    const domainPrefix =
      req.body.ingress?.domainPrefix || req.body.domainPrefix || "";

    const namespace = getNamespace(owner.toString(), name);
    const deploymentName = getResourceName("deploy", name);
    const serviceName = getResourceName("svc", name);

    const ingressHost = buildIngressHost({ name, username, domainPrefix });

    let subdomainHosts: Record<string, string> = {};
    if (ingress?.subdomains) {
      Object.keys(ingress.subdomains).forEach((sub) => {
        subdomainHosts[sub] = buildSubdomainHost({ subdomain: sub, username });
      });
    }

    const app = await Application.create({
      name,
      imageUrl,
      imageTag,
      registryToken,
      namespace,
      deploymentName,
      serviceName,
      ingressHost,
      env: envVars,
      resources,
      ports,
      volumes,
      ingress: {
        domainPrefix,
        host: ingressHost,
        subdomains: ingress?.subdomains || {},
        subdomainHosts,
      },
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
    const username = (req.user as any)?.username || req.body.username || "user";
    const domainPrefix =
      req.body.ingress?.domainPrefix || req.body.domainPrefix || "";
    const namespace = getNamespace(owner.toString(), name);
    const deploymentName = getResourceName("deploy", name);
    const serviceName = getResourceName("svc", name);

    const ingressHost = buildIngressHost({ name, username, domainPrefix });

    let subdomainHosts: Record<string, string> = {};
    if (ingress?.subdomains) {
      Object.keys(ingress.subdomains).forEach((sub) => {
        subdomainHosts[sub] = buildSubdomainHost({ subdomain: sub, username });
      });
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
        ingressHost,
        env: envVars,
        resources,
        ports,
        volumes,
        ingress: {
          domainPrefix,
          host: ingressHost,
          subdomains: ingress?.subdomains || {},
          subdomainHosts,
        },
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
