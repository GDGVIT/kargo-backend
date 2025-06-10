import { Router } from "express";
import { ensureAdmin } from "../auth/role.middleware";
import { asyncHandler } from "../utils/handlers/asyncHandler";
import getPlanByID from "../controllers/plans/getPlanByID.controller";
import createPlan from "../controllers/plans/createPlan.controller";
import getPlans from "../controllers/plans/getPlans.controller";
import updatePlan from "../controllers/plans/updatePlan.controller";
import deletePlan from "../controllers/plans/deletePlan.controller";

const router = Router();

// Public: get a single plan by ID
router.get("/:id", asyncHandler(getPlanByID));

// All plan management routes require admin
router.use(ensureAdmin);

router.post("/", asyncHandler(createPlan));
router.get("/", asyncHandler(getPlans));
router.put("/:id", asyncHandler(updatePlan));
router.delete("/:id", asyncHandler(deletePlan));

export default router;
