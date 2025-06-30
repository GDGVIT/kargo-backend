import { Router, Request, Response } from "express";
import asyncHandler from "../utils/handlers/asyncHandler";
import axios from "axios";
import env from "../config/env";
import ensureAuthenticated from "../utils/auth/ensureAuthenticated";
import getOverallMetrics from "../controllers/metrics/getOverallMetrics.controller";

// Add PROMETHEUS_URL to env type if not present
const prometheusBaseUrl =
  (env as any).PROMETHEUS_URL || "http://localhost:9090";

const router = Router();

// This endpoint fetches overall cluster metrics from Prometheus
router.get("/overall", ensureAuthenticated, getOverallMetrics);

export default router;
