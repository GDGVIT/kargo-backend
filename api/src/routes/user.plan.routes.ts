import { Router } from "express";
import { ensureAuthenticated } from "./auth.routes";
import { asyncHandler } from "../utils/handlers/asyncHandler";
import User from "../models/user.model";
import Plan from "../models/plan.model";

const router = Router();

// Admin or self (if superadmin): assign a plan to a user
router.put(
  "/:id/plan",
  ensureAuthenticated,
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { planId } = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    // Allow: admin/superadmin for others, or self if superadmin
    const reqUser = req.user as any;
    const isSelf = reqUser && reqUser._id?.toString() === id;
    const isAdmin =
      reqUser && (reqUser.role === "admin" || reqUser.role === "superadmin");
    const isSuperadminSelf = isSelf && reqUser.role === "superadmin";
    if (!isAdmin && !isSuperadminSelf) {
      return res.status(403).json({ message: "Not authorized to assign plan" });
    }

    user.plan = String(plan._id);
    await user.save();
    res.json({ message: "Plan assigned to user", user });
  })
);

export default router;
