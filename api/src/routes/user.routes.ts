import { Router } from "express";
import { ensureAuthenticated } from "./auth.routes";
import { ensureAdmin, ensureSuperadmin } from "../auth/role.middleware";
import updateUserResources from "../controllers/user/updateUserResources.controller";
import updateUserRole from "../controllers/user/updateUserRole.controller";
import getUserResourceUsage from "../controllers/user/getUserResourceUsage.controller";
import getRegistryCredentials from "../controllers/user/getRegistryCredentials.controller";
import upsertRegistryCredential from "../controllers/user/upsertRegistryCredential.controller";
import deleteRegistryCredential from "../controllers/user/deleteRegistryCredential.controller";
import updateUserExtraResources from "../controllers/user/updateUserExtraResources.controller";
import { asyncHandler } from "../utils/handlers/asyncHandler";
import User from "../models/user.model";
import Plan from "../models/plan.model";

const router = Router();

router.use(ensureAuthenticated);

// Admin: update resources of a user
router.put("/:id/resources", ensureAdmin, asyncHandler(updateUserResources));

// Superadmin: promote/demote any user (user <-> admin <-> superadmin)
router.put("/:id/role", ensureSuperadmin, asyncHandler(updateUserRole));

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

// Admin: update extra resources of a user
router.put(
  "/:id/extra-resources",
  ensureAdmin,
  asyncHandler(updateUserExtraResources)
);

// Get total resource usage and allowed for a user
router.get(
  "/:id/resource-usage",
  ensureAuthenticated,
  asyncHandler(getUserResourceUsage)
);

// Get total resource usage and allowed for a user (self)
router.get(
  "/me/resource-usage",
  ensureAuthenticated,
  asyncHandler(getUserResourceUsage)
);

// GET all users (admin/superadmin only): name, email, role, plan
router.get(
  "/",
  ensureAdmin,
  asyncHandler(async (_req, res) => {
    const users = await User.find(
      {},
      "_id name email role username plan extraResources"
    ).populate({
      path: "plan",
      select: "_id name isDefault resources", // <-- include resources
    });
    res.json({ users });
  })
);

// Registry credentials management
router.get("/me/credentials", asyncHandler(getRegistryCredentials));
router.post("/me/credentials", asyncHandler(upsertRegistryCredential));
router.delete("/me/credentials", asyncHandler(deleteRegistryCredential));

export default router;
