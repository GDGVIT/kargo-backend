import { Request, Response, NextFunction } from "express";
import User from "../models/user.model";
import { isValidObjectId } from "mongoose";

// Admin: update resources of a user
export const updateUserResources = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { resources } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (!resources) {
      return res.status(400).json({ message: "Resources are required" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.resources = resources;
    await user.save();
    return res.json({ message: "Resources updated", user });
  } catch (err) {
    next(err);
  }
};

// Superadmin: promote/demote admin or user
export const updateUserRole = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (!role || !["user", "admin", "superadmin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Prevent superadmin from demoting themselves
    if (
      req.user &&
      (req.user as any)._id?.toString() === id &&
      role !== "superadmin"
    ) {
      return res
        .status(403)
        .json({ message: "Superadmin cannot demote themselves" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.role = role;
    await user.save();
    return res.json({ message: `User role updated to ${role}` });
  } catch (err) {
    next(err);
  }
};

// Admin: update extra resources of a user
export const updateUserExtraResources = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { extraResources } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (!extraResources) {
      return res.status(400).json({ message: "Extra resources are required" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.extraResources = extraResources;
    await user.save();
    return res.json({ message: "Extra resources updated", user });
  } catch (err) {
    next(err);
  }
};

// Get total resource usage and allowed for a user
export const getUserResourceUsage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId =
      (req.user &&
        ("id" in req.user ? (req.user as any).id : (req.user as any)._id)) ||
      req.params.id;
    if (!userId) {
      return res.status(400).json({ message: "User id required" });
    }
    // Get user with plan and extraResources
    const user = await User.findById(userId).populate("plan");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // Calculate allowed resources (plan + extraResources)
    let planResources: any = {};
    if (
      user.plan &&
      typeof user.plan === "object" &&
      "resources" in user.plan
    ) {
      planResources = (user.plan as any).resources || {};
    }
    const extra = user.extraResources || {};
    function parse(val: string | undefined) {
      if (!val) return 0;
      if (val.endsWith("m")) return parseInt(val) / 1000;
      if (val.endsWith("Mi")) return parseInt(val);
      if (val.endsWith("Gi")) return parseInt(val) * 1024;
      return parseFloat(val);
    }
    const allowed = {
      requests: {
        cpu: parse(planResources.requests?.cpu) + parse(extra.requests?.cpu),
        memory:
          parse(planResources.requests?.memory) + parse(extra.requests?.memory),
      },
      limits: {
        cpu: parse(planResources.limits?.cpu) + parse(extra.limits?.cpu),
        memory:
          parse(planResources.limits?.memory) + parse(extra.limits?.memory),
      },
    };
    // Sum all app resource usage for this user
    const userIdForQuery = (user as any)._id || (user as any).id || user.id;
    const apps = await (
      await import("../models/application.model")
    ).default.find({ owner: userIdForQuery });
    const usage = {
      requests: { cpu: 0, memory: 0 },
      limits: { cpu: 0, memory: 0 },
    };
    for (const app of apps) {
      usage.requests.cpu += parse(app.resources?.requests?.cpu);
      usage.requests.memory += parse(app.resources?.requests?.memory);
      usage.limits.cpu += parse(app.resources?.limits?.cpu);
      usage.limits.memory += parse(app.resources?.limits?.memory);
    }
    return res.json({ allowed, usage });
  } catch (err) {
    next(err);
  }
};
