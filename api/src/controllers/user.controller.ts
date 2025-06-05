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
