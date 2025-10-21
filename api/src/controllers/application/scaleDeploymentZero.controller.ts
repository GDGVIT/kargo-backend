import { Request, Response } from 'express';
import { exec } from 'child_process';
import Application from '../../models/application.model';
import asyncHandler from '../../utils/handlers/asyncHandler';
import log, { formatNotification } from '../../utils/logging/logger';

const scaleDeploymentZero = asyncHandler(async (req: Request, res: Response) => {
  const app = await Application.findById(req.params.id);
  if (!app) {
    log({ type: 'error', message: 'Application not found' });
    return res.status(404).json(formatNotification('Application not found', 'error'));
  }
  const namespace = app.namespace || 'default';
  const deploymentName = app.deploymentName || app.name;
  exec(
    `kubectl scale deployment/${deploymentName}-deployment --replicas=0 -n ${namespace}`,
    (err, stdout, stderr) => {
      if (err) {
        log({
          type: 'error',
          message: 'Failed to scale deployment to 0',
          meta: err,
        });
        return res.status(500).json({
          ...formatNotification('Failed to remove deployment (scale to 0)', 'error'),
          error: stderr,
        });
      }
      log({
        type: 'success',
        message: `Deployment scaled to 0 for app: ${app.name}`,
      });
      res.json({
        ...formatNotification('Deployment scaled to 0', 'success'),
        output: stdout,
      });
    }
  );
});

export default scaleDeploymentZero;
