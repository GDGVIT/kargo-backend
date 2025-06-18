import { Request } from "express";
import User from "../models/user.model";
import { IUser } from "../types/user.types";
import { Document } from "mongoose";

async function getUserFromSession(
  req: Request
): Promise<(IUser & Document) | null> {
  if (!req.user) return null;
  return User.findById((req.user as any)._id);
}

export default getUserFromSession;
