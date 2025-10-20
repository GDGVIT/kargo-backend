// Plan routes for managing subscription plans
import { Router } from 'express';
import { ensureAdmin } from '../auth/role.middleware';
import asyncHandler from '../utils/handlers/asyncHandler';
import getPlanByID from '../controllers/plans/getPlanByID.controller';
import createPlan from '../controllers/plans/createPlan.controller';
import getPlans from '../controllers/plans/getPlans.controller';
import updatePlan from '../controllers/plans/updatePlan.controller';
import deletePlan from '../controllers/plans/deletePlan.controller';

const router = Router();

// Public: Get a single plan by ID
router.get('/:id', asyncHandler(getPlanByID));
// Public: Get all plans
router.get('/', asyncHandler(getPlans));

// All plan management routes below require admin privileges
router.use(ensureAdmin);

// Admin: Create a new plan
router.post('/', asyncHandler(createPlan));
// Admin: Update a plan by ID
router.put('/:id', asyncHandler(updatePlan));
// Admin: Delete a plan by ID
router.delete('/:id', asyncHandler(deletePlan));

export default router;
