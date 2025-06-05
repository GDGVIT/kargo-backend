import { Router } from "express";
import {
  createApplication,
  getApplications,
  getApplication,
  updateApplication,
  deleteApplication,
  applyApplication, // <-- add import
} from "../controllers/application.controller";
import { ensureAuthenticated } from "./auth.routes";

const router = Router();

router.use(ensureAuthenticated);

router.post("/", createApplication);
router.get("/", getApplications);
router.get("/:id", getApplication);
router.put("/:id", updateApplication);
router.delete("/:id", deleteApplication);
router.post("/:id/apply", applyApplication); // <-- add route

export default router;
