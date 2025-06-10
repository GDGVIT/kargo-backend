import { Request, Response, NextFunction } from "express";
import User from "../models/user.model";
import { isValidObjectId } from "mongoose";
import { log, formatNotification } from "../utils/logger";

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
      log({ type: "error", message: "Invalid user id" });
      return res
        .status(400)
        .json(formatNotification("Invalid user id", "error"));
    }

    if (!resources) {
      log({ type: "error", message: "Resources are required" });
      return res
        .status(400)
        .json(formatNotification("Resources are required", "error"));
    }

    const user = await User.findById(id);
    if (!user) {
      log({ type: "error", message: "User not found" });
      return res
        .status(404)
        .json(formatNotification("User not found", "error"));
    }

    user.resources = resources;
    await user.save();
    log({
      type: "success",
      message: `Resources updated for user: ${user.email}`,
    });
    return res.json({
      ...formatNotification("Resources updated", "success"),
      user,
    });
  } catch (err) {
    log({ type: "error", message: "Failed to update resources", meta: err });
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
      log({ type: "error", message: "Superadmin cannot demote themselves" });
      return res
        .status(403)
        .json(
          formatNotification("Superadmin cannot demote themselves", "error")
        );
    }

    const user = await User.findById(id);
    if (!user) {
      log({ type: "error", message: "User not found" });
      return res
        .status(404)
        .json(formatNotification("User not found", "error"));
    }

    user.role = role;
    await user.save();
    log({
      type: "success",
      message: `User role updated to ${role} for user: ${user.email}`,
    });
    return res.json({
      ...formatNotification(`User role updated to ${role}`, "success"),
      user,
    });
  } catch (err) {
    log({ type: "error", message: "Failed to update user role", meta: err });
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
      log({ type: "error", message: "Invalid user id" });
      return res
        .status(400)
        .json(formatNotification("Invalid user id", "error"));
    }

    if (!extraResources) {
      log({ type: "error", message: "Extra resources are required" });
      return res
        .status(400)
        .json(formatNotification("Extra resources are required", "error"));
    }

    const user = await User.findById(id);
    if (!user) {
      log({ type: "error", message: "User not found" });
      return res
        .status(404)
        .json(formatNotification("User not found", "error"));
    }

    user.extraResources = extraResources;
    await user.save();
    log({
      type: "success",
      message: `Extra resources updated for user: ${user.email}`,
    });
    return res.json({
      ...formatNotification("Extra resources updated", "success"),
      user,
    });
  } catch (err) {
    log({
      type: "error",
      message: "Failed to update extra resources",
      meta: err,
    });
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
      log({ type: "error", message: "User id required" });
      return res
        .status(400)
        .json(formatNotification("User id required", "error"));
    }
    // Get user with plan and extraResources
    const user = await User.findById(userId).populate("plan");
    if (!user) {
      log({ type: "error", message: "User not found" });
      return res
        .status(404)
        .json(formatNotification("User not found", "error"));
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
    log({
      type: "error",
      message: "Failed to get user resource usage",
      meta: err,
    });
    next(err);
  }
};

// Add or update a registry credential for the authenticated user
export const upsertRegistryCredential = async (req: Request, res: Response) => {
  const userId = (req.user as any)?._id;
  const { name, registryType, username, token } = req.body;
  if (!name || !registryType || !username || !token) {
    log({ type: "error", message: "All fields are required" });
    return res
      .status(400)
      .json(formatNotification("All fields are required", "error"));
  }
  const user = await User.findById(userId);
  if (!user) {
    log({ type: "error", message: "User not found" });
    return res.status(404).json(formatNotification("User not found", "error"));
  }
  const existing = user.credentials?.find(
    (c) => c.name === name && c.registryType === registryType
  );
  if (existing) {
    existing.username = username;
    existing.token = token;
  } else {
    user.credentials?.push({ name, registryType, username, token });
  }
  await user.save();
  log({ type: "success", message: `Credential saved for user: ${user.email}` });
  res.json({
    ...formatNotification("Credential saved", "success"),
    credentials: user.credentials,
  });
};

// Remove a registry credential by name and type
export const deleteRegistryCredential = async (req: Request, res: Response) => {
  const userId = (req.user as any)?._id;
  const { name, registryType } = req.body;
  const user = await User.findById(userId);
  if (!user) {
    log({ type: "error", message: "User not found" });
    return res.status(404).json(formatNotification("User not found", "error"));
  }
  user.credentials = (user.credentials || []).filter(
    (c) => !(c.name === name && c.registryType === registryType)
  );
  await user.save();
  log({
    type: "success",
    message: `Credential deleted for user: ${user.email}`,
  });
  res.json({
    ...formatNotification("Credential deleted", "success"),
    credentials: user.credentials,
  });
};

// Get all registry credentials for the authenticated user
export const getRegistryCredentials = async (req: Request, res: Response) => {
  const userId = (req.user as any)?._id;
  const user = await User.findById(userId);
  if (!user) {
    log({ type: "error", message: "User not found" });
    return res.status(404).json(formatNotification("User not found", "error"));
  }
  res.json({ credentials: user.credentials || [] });
};
