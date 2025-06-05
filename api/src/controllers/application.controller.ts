import { Request, Response } from "express";
import Application from "../models/application.model";
import { asyncHandler } from "../utils/asyncHandler";

// Create Application
export const createApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      name,
      imageUrl,
      imageTag,
      registryToken,
      namespace,
      deploymentName,
      serviceName,
      ingressHost,
      env,
    } = req.body;
    const owner = (req.user as any)?._id || req.body.owner;
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
    const app = await Application.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
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
