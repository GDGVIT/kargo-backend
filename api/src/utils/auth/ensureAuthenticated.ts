import { Response, NextFunction } from "express";

export default function ensureAuthenticated(
  req: any,
  res: Response,
  next: NextFunction
) {
  if (typeof req.isAuthenticated === "function" && req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Not authenticated" });
}
