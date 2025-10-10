import { Request, Response, NextFunction } from 'express';
import User from '../../models/user.model';
import { isValidObjectId } from 'mongoose';
import log, { formatNotification } from '../../utils/logging/logger';
import type IUser from '../../types/user.types';
import type { Document } from 'mongoose';

// Admin: update extra resources of a user
const updateUserExtraResources = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { extraResources } = req.body;

    if (!isValidObjectId(id)) {
      log({ type: 'error', message: 'Invalid user id' });
      return res.status(400).json(formatNotification('Invalid user id', 'error'));
    }

    if (!extraResources) {
      log({ type: 'error', message: 'Extra resources are required' });
      return res.status(400).json(formatNotification('Extra resources are required', 'error'));
    }

    const user = (await User.findById(id)) as (IUser & Document) | null;
    if (!user) {
      log({ type: 'error', message: 'User not found' });
      return res.status(404).json(formatNotification('User not found', 'error'));
    }

    user.extraResources = extraResources;
    await user.save();
    log({
      type: 'success',
      message: `Extra resources updated for user: ${user.email}`,
    });
    return res.json({
      ...formatNotification('Extra resources updated', 'success'),
      user,
    });
  } catch (err) {
    log({
      type: 'error',
      message: 'Failed to update extra resources',
      meta: err,
    });
    next(err);
  }
};

export default updateUserExtraResources;
