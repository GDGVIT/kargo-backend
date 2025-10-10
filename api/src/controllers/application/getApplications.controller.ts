import { Request, Response } from 'express';
import Application from '../../models/application.model';
import asyncHandler from '../../utils/handlers/asyncHandler';
import log, { formatNotification } from '../../utils/logging/logger';

const getApplications = asyncHandler(async (req: Request, res: Response) => {
  try {
    const owner = (req.user as any)?._id || req.query.owner;
    const apps = await Application.find({ owner });
    log({
      type: 'info',
      message: `Fetched applications for owner: ${owner}`,
    });
    res.json({
      ...formatNotification('Fetched applications', 'info'),
      applications: apps,
    });
  } catch (err) {
    log({
      type: 'error',
      message: 'Failed to fetch applications',
      meta: err,
    });
    res.status(500).json(formatNotification('Failed to fetch applications', 'error'));
  }
});

export default getApplications;
