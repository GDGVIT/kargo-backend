// Application routes for managing user applications, deployments, logs, and metrics
import { Router } from "express";
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
import scaleDeploymentZero from "../controllers/application/scaleDeploymentZero.controller";
import rolloutRestartDeployment from "../controllers/application/rolloutRestartDeployment.controller";
import testImageAvailabilityController from "../controllers/application/testImageAvailability.controller";

const router = Router();

// All routes require authentication
router.use(ensureAuthenticated);

// Create a new application
router.post("/", createApplication);
// Get all applications for the user
router.get("/", getApplications);
// Get a specific application by ID
router.get("/:id", getApplication);
// Update an application by ID
router.put("/:id", updateApplication);
// Delete an application by ID
router.delete("/:id", deleteApplication);
// Apply (deploy) an application
router.post("/:id/apply", applyApplication);
// Remove a deployment for an application
router.post("/:id/remove-deployment", removeDeployment);
// Scale deployment to 0 replicas
router.post("/:id/scale-zero", scaleDeploymentZero);
// Rollout restart deployment
router.post("/:id/rollout-restart", rolloutRestartDeployment);
// Remove a namespace for an application
router.post("/:id/remove-namespace", removeNamespace);
// Stream logs for an application
router.get("/:id/logs", streamApplicationLogs);
// Get metrics for an application
router.get("/:id/metrics", getApplicationMetrics);
// Test Docker image availability
router.post("/test-image", testImageAvailabilityController);
// Run a Docker handler (async)
router.post("/run-docker", asyncHandler(runDockerHandler));

export default router;
