import { Request, Response, NextFunction } from 'express';
import Plan from '../../models/plan.model';
import log, { formatNotification } from '../../utils/logging/logger';

// Create a new plan (admin only)
const createPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, resources, isDefault, price, isActive } = req.body;
    if (!name || !resources) {
      log({ type: 'error', message: 'Name and resources are required' });
      return res.status(400).json(formatNotification('Name and resources are required', 'error'));
    }
    if (isDefault) {
      // Only one default plan allowed
      await Plan.updateMany({ isDefault: true }, { isDefault: false });
    }
    const plan = await Plan.create({
      name,
      description,
      resources,
      isDefault,
      price,
      isActive,
    });
    log({ type: 'success', message: `Plan created: ${name}` });
    res.status(201).json({ ...formatNotification('Plan created', 'success'), plan });
  } catch (err) {
    log({ type: 'error', message: 'Failed to create plan', meta: err });
    next(err);
  }
};

export default createPlan;
