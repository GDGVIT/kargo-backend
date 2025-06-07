import { Router } from "express";
import { ensureAuthenticated } from "./auth.routes";
import { ensureAdmin, ensureSuperadmin } from "../auth/role.middleware";
import {
  updateUserResources,
  updateUserRole,
  updateUserExtraResources,
  getUserResourceUsage,
  upsertRegistryCredential,
  deleteRegistryCredential,
  getRegistryCredentials,
} from "../controllers/user.controller";
import { asyncHandler } from "../utils/asyncHandler";
import User from "../models/user.model";

const router = Router();

router.use(ensureAuthenticated);

// Admin: update resources of a user
router.put("/:id/resources", ensureAdmin, asyncHandler(updateUserResources));

// Superadmin: promote/demote any user (user <-> admin <-> superadmin)
router.put("/:id/role", ensureSuperadmin, asyncHandler(updateUserRole));

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

// GET all users (admin/superadmin only): name, email, role
router.get(
  "/",
  ensureAdmin,
  asyncHandler(async (_req, res) => {
    const users = await User.find({}, "_id name email role username");
    res.json({ users });
  })
);

// Registry credentials management
router.get("/me/credentials", asyncHandler(getRegistryCredentials));
router.post("/me/credentials", asyncHandler(upsertRegistryCredential));
router.delete("/me/credentials", asyncHandler(deleteRegistryCredential));

export default router;
