import { Request, Response } from 'express';
import type { Document } from 'mongoose';
import User from '../../models/user.model';
import log, { formatNotification } from '../../utils/logging/logger';
import type IUser from '../../types/user.types';

// Remove a registry credential by name and type
const deleteRegistryCredential = async (req: Request, res: Response) => {
  const userId = (req.user as any)?._id;
  const { name, registryType } = req.body;
  const user = (await User.findById(userId)) as (IUser & Document) | null;
  if (!user) {
    log({ type: 'error', message: 'User not found' });
    return res.status(404).json(formatNotification('User not found', 'error'));
  }
  user.credentials = (user.credentials || []).filter(
    (c) => !(c.name === name && c.registryType === registryType)
  );
  await user.save();
  log({
    type: 'success',
    message: `Credential deleted for user: ${user.email}`,
  });
  res.json({
    ...formatNotification('Credential deleted', 'success'),
    credentials: user.credentials,
  });
};

export default deleteRegistryCredential;
