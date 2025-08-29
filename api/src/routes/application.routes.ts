// Application routes for managing user applications, deployments, logs, and metrics
import { Router, Request, Response, NextFunction } from "express";
import ensureAuthenticated from "../utils/auth/ensureAuthenticated";
import asyncHandler from "../utils/handlers/asyncHandler";

import createApplication from "../controllers/application/createApplication.controller";
import getApplications from "../controllers/application/getApplications.controller";
import getApplication from "../controllers/application/getApplication.controller";
import updateApplication from "../controllers/application/updateApplication.controller";
import deleteApplication from "../controllers/application/deleteApplication.controller";
import applyApplication from "../controllers/application/applyApplication.controller";
import runDockerHandler from "../controllers/application/runDockerHandler.controller";
import removeDeployment from "../controllers/application/removeDeployment.controller";
import removeNamespace from "../controllers/application/removeNamespace.controller";
import streamApplicationLogs from "../controllers/application/streamApplicationLogs.controller";
import getApplicationMetrics from "../controllers/application/getApplicationMetrics.controller";
import getApplicationsStatus from "../controllers/application/getApplicationsStatus.controller";
import scaleDeploymentZero from "../controllers/application/scaleDeploymentZero.controller";
import rolloutRestartDeployment from "../controllers/application/rolloutRestartDeployment.controller";
import testImageAvailabilityController from "../controllers/application/testImageAvailability.controller";

const validateObjectId = (req: Request, res: Response, next: NextFunction) => {
  const id = req.params.id;

  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    res.status(400).json({ message: "Invalid application ID format" });
    return;
  }
  next();
};

const router = Router();

// All routes require authentication
router.use(ensureAuthenticated);

// Create a new application
router.post("/", createApplication);
// Get all applications for the user
router.get("/", getApplications);
// Get live status for all applications - must be before /:id route
router.get("/status", getApplicationsStatus);
// Get a specific application by ID (with ObjectId validation)
router.get("/:id", validateObjectId, getApplication);
// Update an application by ID
router.put("/:id", validateObjectId, updateApplication);
// Delete an application by ID
router.delete("/:id", validateObjectId, deleteApplication);
// Apply (deploy) an application
router.post("/:id/apply", validateObjectId, applyApplication);
// Remove a deployment for an application
router.post("/:id/remove-deployment", validateObjectId, removeDeployment);
// Scale deployment to 0 replicas
router.post("/:id/scale-zero", validateObjectId, scaleDeploymentZero);
// Rollout restart deployment
router.post("/:id/rollout-restart", validateObjectId, rolloutRestartDeployment);
// Remove a namespace for an application
router.post("/:id/remove-namespace", validateObjectId, removeNamespace);
// Stream logs for an application
router.get("/:id/logs", validateObjectId, streamApplicationLogs);
// Get metrics for an application
router.get("/:id/metrics", validateObjectId, getApplicationMetrics);
// Test Docker image availability
router.post("/test-image", testImageAvailabilityController);
// Run a Docker handler (async)
router.post("/run-docker", asyncHandler(runDockerHandler));

export default router;
