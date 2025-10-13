import { Router, Request, Response } from 'express';
import asyncHandler from '../utils/handlers/asyncHandler';
import axios from 'axios';
import env from '../config/env';
import ensureAuthenticated from '../utils/auth/ensureAuthenticated';
import getOverallMetrics from '../controllers/metrics/getOverallMetrics.controller';

// Add PROMETHEUS_URL to env type if not present
const prometheusBaseUrl = (env as any).PROMETHEUS_URL || 'http://localhost:9090';

const router = Router();

router.get('/apiuptime', ensureAuthenticated, (req: Request, res: Response) => {
  const uptime = Math.round(process.uptime());
  const now = Math.floor(Date.now() / 1000);
  const history = Array.from({ length: 60 }, (_, i) => {
    const ts = now - (59 - i) * 60;
    const up = Math.max(uptime - (59 - i) * 60, 0);
    return [ts, up];
  });
  res.json({ uptime, history });
});

router.get('/overall', ensureAuthenticated, getOverallMetrics);

export default router;
