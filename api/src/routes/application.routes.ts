import { Router } from "express";
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
import ensureAuthenticated from "../utils/auth/ensureAuthenticated";
import asyncHandler from "../utils/handlers/asyncHandler";

const router = Router();

router.use(ensureAuthenticated);

router.post("/", createApplication);
router.get("/", getApplications);
router.get("/:id", getApplication);
router.put("/:id", updateApplication);
router.delete("/:id", deleteApplication);
router.delete("/:id/delete-all", deleteApplicationAndResources);
router.post("/:id/apply", applyApplication);
router.post("/:id/remove-deployment", removeDeployment);
router.post("/:id/remove-namespace", removeNamespace);
router.get("/:id/logs", streamApplicationLogs);
router.get("/:id/metrics", getApplicationMetrics);
router.post("/run-docker", asyncHandler(runDockerHandler));

export default router;
