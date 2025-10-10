import { Request, Response } from 'express';
import Application from '../../models/application.model';
import asyncHandler from '../../utils/handlers/asyncHandler';
import { exec } from 'child_process';

function getK8sStatus(namespace: string, deployment: string): Promise<string> {
  return new Promise((resolve) => {
    exec(
      `kubectl get deployment ${deployment}-deployment -n ${namespace} -o json`,
      (err, stdout) => {
        if (err) return resolve('offline');
        try {
          const obj = JSON.parse(stdout);
          const available = obj.status?.availableReplicas ?? 0;
          const desired = obj.status?.replicas ?? 0;
          if (desired === 0) return resolve('stopped');
          if (available === desired) return resolve('online');
          if (available === 0 && desired > 0) return resolve('starting');
          if (available < desired) return resolve('partially online');
          return resolve('unknown');
        } catch {
          return resolve('unknown');
        }
      }
    );
  });
}

const getApplicationsStatus = asyncHandler(async (req: Request, res: Response) => {
  const owner = (req.user as any)?._id || req.query.owner;
  const apps = await Application.find({ owner });
  const statusResults = await Promise.all(
    apps.map(async (app: any) => {
      const namespace = app.namespace || 'default';
      const deployment = app.deploymentName || app.name;
      const status = await getK8sStatus(namespace, deployment);
      return {
        id: app._id,
        name: app.name,
        status,
      };
    })
  );
  res.json({ status: statusResults });
});

export default getApplicationsStatus;
