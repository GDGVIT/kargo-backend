import { Router } from "express";
import { ensureAdmin } from "../auth/role.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import {
  createPlan,
  getPlans,
  updatePlan,
  deletePlan,
  getPlanById,
} from "../controllers/plan.controller";

const router = Router();

// Public: get a single plan by ID
router.get("/:id", asyncHandler(getPlanById));

// All plan management routes require admin
router.use(ensureAdmin);

router.post("/", asyncHandler(createPlan));
router.get("/", asyncHandler(getPlans));
router.put("/:id", asyncHandler(updatePlan));
router.delete("/:id", asyncHandler(deletePlan));

export default router;
