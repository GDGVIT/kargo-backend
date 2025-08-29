import { Request, Response } from "express";
import Application from "../../models/application.model";
import asyncHandler from "../../utils/handlers/asyncHandler";
import {
  getNamespace,
  getResourceName,
} from "../../utils/k8s/helpers/k8sHelpers";
import { mapPorts } from "../../utils/k8s/helpers/portHelpers";
import log, { formatNotification } from "../../utils/logging/logger";

const createApplication = asyncHandler(async (req: Request, res: Response) => {
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
});

export default createApplication;
