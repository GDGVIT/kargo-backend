// Application routes for managing user applications, deployments, logs, and metrics
import { Router } from "express";
import ensureAuthenticated from "../utils/auth/ensureAuthenticated";
import asyncHandler from "../utils/handlers/asyncHandler";

import createApplication from "../controllers/application/createApplication.controller";
import getApplications from "../controllers/application/getApplications.controller";
import getApplication from "../controllers/application/getApplication.controller";
import updateApplication from "../controllers/application/updateApplication.controller";
import deleteApplication from "../controllers/application/deleteApplication.controller";
import deleteApplicationAndResources from "../controllers/application/deleteApplicationAndResources.controller";
import applyApplication from "../controllers/application/applyApplication.controller";
import runDockerHandler from "../controllers/application/runDockerHandler.controller";
import removeDeployment from "../controllers/application/removeDeployment.controller";
import removeNamespace from "../controllers/application/removeNamespace.controller";
import streamApplicationLogs from "../controllers/application/streamApplicationLogs.controller";
import getApplicationMetrics from "../controllers/application/getApplicationMetrics.controller";

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
// Delete an application and all its resources
router.delete("/:id/delete-all", deleteApplicationAndResources);
// Apply (deploy) an application
router.post("/:id/apply", applyApplication);
// Remove a deployment for an application
router.post("/:id/remove-deployment", removeDeployment);
// Remove a namespace for an application
router.post("/:id/remove-namespace", removeNamespace);
// Stream logs for an application
router.get("/:id/logs", streamApplicationLogs);
// Get metrics for an application
router.get("/:id/metrics", getApplicationMetrics);
// Run a Docker handler (async)
router.post("/run-docker", asyncHandler(runDockerHandler));

export default router;
