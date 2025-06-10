import { Request, Response } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import User from "../../models/user.model";
import { log, formatNotification } from "../logging/logger";
import type { Document } from "mongoose";
import { IUser } from "../../types/user.types";

async function getUserFromSession(
  req: Request
): Promise<(IUser & Document) | null> {
  if (!req.user) return null;
  return User.findById((req.user as any)._id);
}

export default getUserFromSession;
