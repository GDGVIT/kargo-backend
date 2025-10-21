import { Request, Response, NextFunction } from 'express';
import { isValidObjectId, type Document } from 'mongoose';
import User from '../../models/user.model';
import log, { formatNotification } from '../../utils/logging/logger';
import type IUser from '../../types/user.types';

// Admin: update resources of a user
const updateUserResources = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { resources } = req.body;

    if (!isValidObjectId(id)) {
      log({ type: 'error', message: 'Invalid user id' });
      return res.status(400).json(formatNotification('Invalid user id', 'error'));
    }

    if (!resources) {
      log({ type: 'error', message: 'Resources are required' });
      return res.status(400).json(formatNotification('Resources are required', 'error'));
    }

    const user = (await User.findById(id)) as (IUser & Document) | null;
    if (!user) {
      log({ type: 'error', message: 'User not found' });
      return res.status(404).json(formatNotification('User not found', 'error'));
    }

    user.resources = resources;
    await user.save();
    log({
      type: 'success',
      message: `Resources updated for user: ${user.email}`,
    });
    return res.json({
      ...formatNotification('Resources updated', 'success'),
      user,
    });
  } catch (err) {
    log({ type: 'error', message: 'Failed to update resources', meta: err });
    next(err);
  }
};

export default updateUserResources;
