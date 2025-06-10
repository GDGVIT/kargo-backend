import { Request, Response, NextFunction } from "express";
import Plan from "../models/plan.model";
import { log, formatNotification } from "../utils/logger";
import type { IPlan } from "../types/plan.types";
import type { Document } from "mongoose";

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
      log({ type: "error", message: "Name and resources are required" });
      return res
        .status(400)
        .json(formatNotification("Name and resources are required", "error"));
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
    log({ type: "success", message: `Plan created: ${name}` });
    res
      .status(201)
      .json({ ...formatNotification("Plan created", "success"), plan });
  } catch (err) {
    log({ type: "error", message: "Failed to create plan", meta: err });
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
    let plans = await Plan.find();
    // Ensure all plans have resources, requests, and limits fields
    plans = plans.map((plan: IPlan & Document) => {
      const p = plan.toObject();
      p.resources = p.resources || {};
      p.resources.requests = p.resources.requests || {};
      p.resources.limits = p.resources.limits || {};
      return p;
    });
    log({ type: "info", message: "Fetched all plans" });
    res.json({ ...formatNotification("Fetched all plans", "info"), plans });
  } catch (err) {
    log({ type: "error", message: "Failed to fetch plans", meta: err });
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
    let plan = (await Plan.findById(req.params.id)) as
      | (IPlan & Document)
      | null;
    if (!plan) return res.status(404).json({ message: "Plan not found" });
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
