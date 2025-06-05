import { Request, Response, NextFunction } from "express";
import { IUser } from "../models/user.model";

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
    res.status(403).json({ message: "Admin access required" });
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
    res.status(403).json({ message: "Superadmin access required" });
  }
}
