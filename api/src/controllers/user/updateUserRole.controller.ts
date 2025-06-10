import { Request, Response, NextFunction } from "express";
import User from "../../models/user.model";
import { isValidObjectId } from "mongoose";
import { log, formatNotification } from "../../utils/logging/logger";
import type { IUser } from "../../types/user.types";
import type { Document } from "mongoose";

// Superadmin: promote/demote admin or user
const updateUserRole = async (
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

    const user = (await User.findById(id)) as (IUser & Document) | null;
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

export default updateUserRole;
