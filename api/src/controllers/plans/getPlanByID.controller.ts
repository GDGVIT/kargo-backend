import { Request, Response, NextFunction } from 'express';
import Plan from '../../models/plan.model';
import type IPlan from '../../types/plan.types';
import type { Document } from 'mongoose';

// Public: get a single plan by ID
const getPlanByID = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let plan = (await Plan.findById(req.params.id)) as (IPlan & Document) | null;
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    // Ensure plan has resources, requests, and limits fields
    const p = plan.toObject();
    p.resources = p.resources || {};
    p.resources.requests = p.resources.requests || {};
    p.resources.limits = p.resources.limits || {};
    res.json(p);
  } catch (err) {
    next(err);
  }
};

export default getPlanByID;
