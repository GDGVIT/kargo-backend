// Plan routes for managing subscription plans and handling payments
import { Router } from "express";
import { ensureAdmin } from "../auth/role.middleware";
import asyncHandler from "../utils/handlers/asyncHandler";
import express from "express";
import getPlanByID from "../controllers/plans/getPlanByID.controller";
import createPlan from "../controllers/plans/createPlan.controller";
import getPlans from "../controllers/plans/getPlans.controller";
import updatePlan from "../controllers/plans/updatePlan.controller";
import deletePlan from "../controllers/plans/deletePlan.controller";
import {
  createOrder,
  verifyPayment,
} from "../controllers/plans/razorpay.controller";

const router = Router();

// Public: Get a single plan by ID
router.get(":/id", asyncHandler(getPlanByID));
// Public: Get all plans
router.get("/", asyncHandler(getPlans));

// Razorpay payment endpoints (public)
router.post(":/id/create-order", asyncHandler(createOrder));
router.post("/verify-payment", express.json(), (req, res) => {
  verifyPayment(req, res);
});

// All plan management routes below require admin privileges
router.use(ensureAdmin);

// Admin: Create a new plan
router.post("/", asyncHandler(createPlan));
// Admin: Update a plan by ID
router.put(":/id", asyncHandler(updatePlan));
// Admin: Delete a plan by ID
router.delete(":/id", asyncHandler(deletePlan));

export default router;
