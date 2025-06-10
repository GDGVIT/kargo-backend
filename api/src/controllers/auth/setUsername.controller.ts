import { Request, Response, NextFunction } from "express";
import User from "../../models/user.model";
import { log, formatNotification } from "../../utils/logging/logger";
import type { IUser } from "../../types/user.types";
import type { Document } from "mongoose";
import isValidUsername from "../../utils/auth/isValidUsername";
import sanitizeUser from "../../utils/auth/sanitizeUser";

const setUsername = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated?.() || !req.user) {
      log({
        type: "error",
        message: "You must be logged in to set a username.",
      });
      return res
        .status(401)
        .json(
          formatNotification(
            "You must be logged in to set a username.",
            "error"
          )
        );
    }

    const user = req.user as IUser & Document;

    if (user.username) {
      log({
        type: "warning",
        message: "Username is already set and cannot be changed.",
      });
      return res
        .status(400)
        .json(
          formatNotification(
            "Username is already set and cannot be changed.",
            "warning"
          )
        );
    }

    const { username } = req.body;

    if (!username || !isValidUsername(username)) {
      log({ type: "error", message: "Invalid username format." });
      return res
        .status(400)
        .json(
          formatNotification(
            "Invalid username. Only letters, numbers, underscores, and hyphens are allowed. No spaces.",
            "error"
          )
        );
    }

    const existing = await User.findOne({ username });
    if (existing) {
      log({ type: "warning", message: "This username is already taken." });
      return res
        .status(400)
        .json(
          formatNotification(
            "This username is already taken. Please choose another.",
            "warning"
          )
        );
    }

    user.username = username;
    await user.save();

    log({ type: "success", message: `Username set for user: ${user.email}` });
    return res.json({
      ...formatNotification("Username set successfully!", "success"),
      user: sanitizeUser(user),
    });
  } catch (err) {
    log({ type: "error", message: "Failed to set username", meta: err });
    next(err);
  }
};

export default setUsername;
