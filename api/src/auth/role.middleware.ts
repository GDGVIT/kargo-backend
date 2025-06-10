import { Request, Response, NextFunction } from "express";
import { IUser } from "../types/user.types";
import { log, formatNotification } from "../utils/logging/logger";

// Middleware to check if user is admin or superadmin
export function ensureAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const user = req.user as IUser | undefined;
  if (user && (user.role === "admin" || user.role === "superadmin")) {
    next();
  } else {
    log({ type: "error", message: "Admin access required" });
    res.status(403).json(formatNotification("Admin access required", "error"));
  }
}

// Middleware to check if user is superadmin
export function ensureSuperadmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const user = req.user as IUser | undefined;
  if (user && user.role === "superadmin") {
    next();
  } else {
    log({ type: "error", message: "Superadmin access required" });
    res
      .status(403)
      .json(formatNotification("Superadmin access required", "error"));
  }
}
