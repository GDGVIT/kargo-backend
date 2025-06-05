import { Request, Response, NextFunction } from "express";
import Plan from "../models/plan.model";

// Create a new plan (admin only)
export const createPlan = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, description, resources, isDefault, price, isActive } =
      req.body;
    if (!name || !resources) {
      return res
        .status(400)
        .json({ message: "Name and resources are required" });
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
    res.status(201).json({ message: "Plan created", plan });
  } catch (err) {
    next(err);
  }
};

// Get all plans
export const getPlans = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const plans = await Plan.find();
    res.json({ plans });
  } catch (err) {
    next(err);
  }
};

// Update a plan (admin only)
export const updatePlan = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { name, description, resources, isDefault, price, isActive } =
      req.body;
    if (isDefault) {
      await Plan.updateMany({ isDefault: true }, { isDefault: false });
    }
    const plan = await Plan.findByIdAndUpdate(
      id,
      { name, description, resources, isDefault, price, isActive },
      { new: true }
    );
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.json({ message: "Plan updated", plan });
  } catch (err) {
    next(err);
  }
};

// Delete a plan (admin only)
export const deletePlan = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const plan = await Plan.findByIdAndDelete(id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.json({ message: "Plan deleted" });
  } catch (err) {
    next(err);
  }
};

// Public: get a single plan by ID
export const getPlanById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.json(plan);
  } catch (err) {
    next(err);
  }
};
