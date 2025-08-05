import { Request, Response } from "express";
import Application from "../../models/application.model";
import asyncHandler from "../../utils/handlers/asyncHandler";
import k8sClient from "../../utils/k8s/client";

async function getK8sStatus(namespace: string, deployment: string): Promise<string> {
  try {
    // Use secure Kubernetes client instead of direct kubectl command
    const deploymentInfo = await k8sClient.getDeploymentStatus(deployment, namespace);
    
    const available = deploymentInfo.availableReplicas ?? 0;
    const desired = deploymentInfo.replicas ?? 0;
    
    if (desired === 0) return "stopped";
    if (available === desired) return "online";
    if (available === 0 && desired > 0) return "starting";
    if (available < desired) return "partially online";
    return "unknown";
  } catch (error) {
    return "offline";
  }
}

const getApplicationsStatus = asyncHandler(async (req: Request, res: Response) => {
  const owner = (req.user as any)?._id || req.query.owner;
  const apps = await Application.find({ owner });
  const statusResults = await Promise.all(
    apps.map(async (app: any) => {
      const namespace = app.namespace || "default";
      const deployment = app.deploymentName || app.name;
      const status = await getK8sStatus(namespace, deployment);
      return {
        id: app._id,
        name: app.name,
        status,
      };
    })
  );
  res.json({ status: statusResults });
});

export default getApplicationsStatus;
