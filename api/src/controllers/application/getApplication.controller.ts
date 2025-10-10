import { Request, Response } from 'express';
import Application from '../../models/application.model';
import asyncHandler from '../../utils/handlers/asyncHandler';
import log, { formatNotification } from '../../utils/logging/logger';
import type IApplication from '../../types/application.types';
import type { Document } from 'mongoose';

const getApplication = asyncHandler(async (req: Request, res: Response) => {
  const app = (await Application.findById(req.params.id)) as (IApplication & Document) | null;
  if (!app) {
    log({ type: 'error', message: 'Application not found' });
    return res.status(404).json(formatNotification('Application not found', 'error'));
  }
  log({ type: 'info', message: `Fetched application: ${app.name}` });
  res.json({
    ...formatNotification('Fetched application', 'info'),
    application: app,
  });
});

export default getApplication;
