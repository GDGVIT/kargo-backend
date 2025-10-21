import { Request, Response, NextFunction } from 'express';
import type { Document } from 'mongoose';
import Plan from '../../models/plan.model';
import log, { formatNotification } from '../../utils/logging/logger';
import type IPlan from '../../types/plan.types';

// Get all plans
const getPlans = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    let plans = await Plan.find();
    // Ensure all plans have resources, requests, and limits fields
    plans = plans.map((plan: IPlan & Document) => {
      const p = plan.toObject();
      p.resources = p.resources || {};
      p.resources.requests = p.resources.requests || {};
      p.resources.limits = p.resources.limits || {};
      return p;
    });
    log({ type: 'info', message: 'Fetched all plans' });
    res.json({ ...formatNotification('Fetched all plans', 'info'), plans });
  } catch (err) {
    log({ type: 'error', message: 'Failed to fetch plans', meta: err });
    next(err);
  }
};

export default getPlans;
