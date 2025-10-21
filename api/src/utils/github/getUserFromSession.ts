import { Request } from 'express';
import type { Document } from 'mongoose';
import User from '../../models/user.model';
import IUser from '../../types/user.types';

async function getUserFromSession(req: Request): Promise<(IUser & Document) | null> {
  if (!req.user) return null;
  return User.findById((req.user as any)._id);
}

export default getUserFromSession;
