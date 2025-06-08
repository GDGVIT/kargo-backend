import { Router } from "express";
import { ensureAuthenticated } from "./auth.routes";
import { ensureAdmin } from "../auth/role.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import User from "../models/user.model";
import Plan from "../models/plan.model";

const router = Router();

// Admin: assign a plan to a user
router.put(
  "/:id/plan",
  ensureAuthenticated,
  ensureAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { planId } = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    user.plan = String(plan._id);
    await user.save();
    res.json({ message: "Plan assigned to user", user });
  })
);

export default router;
