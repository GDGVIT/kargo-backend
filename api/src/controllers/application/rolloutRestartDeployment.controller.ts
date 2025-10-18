import { Request, Response } from 'express';
import Application from '../../models/application.model';
import asyncHandler from '../../utils/handlers/asyncHandler';
import log, { formatNotification } from '../../utils/logging/logger';
import { exec } from 'child_process';

const rolloutRestartDeployment = asyncHandler(async (req: Request, res: Response) => {
  const app = await Application.findById(req.params.id);
  if (!app) {
    log({ type: 'error', message: 'Application not found' });
    return res.status(404).json(formatNotification('Application not found', 'error'));
  }
  const namespace = app.namespace || 'default';
  const deploymentName = app.deploymentName || app.name;
  exec(
    `kubectl rollout restart deployment/${deploymentName}-deployment -n ${namespace}`,
    (err, stdout, stderr) => {
      if (err) {
        log({
          type: 'error',
          message: 'Failed to rollout restart deployment',
          meta: err,
        });
        return res.status(500).json({
          ...formatNotification('Failed to restart deployment', 'error'),
          error: stderr,
        });
      }
      log({
        type: 'success',
        message: `Deployment rollout restarted for app: ${app.name}`,
      });
      res.json({
        ...formatNotification('Deployment rollout restarted', 'success'),
        output: stdout,
      });
    }
  );
});

export default rolloutRestartDeployment;
