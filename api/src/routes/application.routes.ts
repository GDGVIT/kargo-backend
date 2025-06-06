import { Router } from "express";
import {
  createApplication,
  getApplications,
  getApplication,
  updateApplication,
  deleteApplication,
  applyApplication,
  removeDeployment,
  removeNamespace,
  deleteApplicationAndResources,
  streamApplicationLogs,
} from "../controllers/application.controller";
import { ensureAuthenticated } from "./auth.routes";

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

export default router;
