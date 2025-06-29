// User routes for managing user resources, roles, plans, and registry credentials
import { Router } from "express";
import ensureAuthenticated from "../utils/auth/ensureAuthenticated";
import { ensureAdmin, ensureSuperadmin } from "../auth/role.middleware";
import asyncHandler from "../utils/handlers/asyncHandler";

import updateUserResources from "../controllers/user/updateUserResources.controller";
import updateUserRole from "../controllers/user/updateUserRole.controller";
import getUserResourceUsage from "../controllers/user/getUserResourceUsage.controller";
import getRegistryCredentials from "../controllers/user/getRegistryCredentials.controller";
import upsertRegistryCredential from "../controllers/user/upsertRegistryCredential.controller";
import deleteRegistryCredential from "../controllers/user/deleteRegistryCredential.controller";
import updateUserExtraResources from "../controllers/user/updateUserExtraResources.controller";
import updateUserPlan from "../controllers/user/updateUserPlan.controller";
import getAllUsers from "../controllers/user/getAllUsers.controller";

const router = Router();

// All routes require authentication
router.use(ensureAuthenticated);

// Admin: update resources of a user
router.put("/:id/resources", ensureAdmin, asyncHandler(updateUserResources));

// Superadmin: promote/demote any user (user <-> admin <-> superadmin)
router.put("/:id/role", ensureSuperadmin, asyncHandler(updateUserRole));

// Admin or self (if superadmin): assign a plan to a user
router.put("/:id/plan", ensureAuthenticated, asyncHandler(updateUserPlan));

// Admin: update extra resources of a user
router.put(
  "/:id/extra-resources",
  ensureAdmin,
  asyncHandler(updateUserExtraResources)
);

// Get total resource usage and allowed for a user (by admin or self)
router.get(
  "/:id/resource-usage",
  ensureAuthenticated,
  asyncHandler(getUserResourceUsage)
);

// Get total resource usage and allowed for the current user
router.get(
  "/me/resource-usage",
  ensureAuthenticated,
  asyncHandler(getUserResourceUsage)
);

// GET all users (admin/superadmin only): name, email, role, plan
router.get("/", ensureAdmin, asyncHandler(getAllUsers));

// Registry credentials management for the current user
router.get("/me/credentials", asyncHandler(getRegistryCredentials));
router.post("/me/credentials", asyncHandler(upsertRegistryCredential));
router.delete("/me/credentials", asyncHandler(deleteRegistryCredential));

export default router;
