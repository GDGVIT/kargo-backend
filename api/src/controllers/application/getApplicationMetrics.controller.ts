import { Request, Response } from "express";
import axios from "axios";
import Application from "../../models/application.model";
import asyncHandler from "../../utils/handlers/asyncHandler";
import log, { formatNotification } from "../../utils/logging/logger";
import env from "../../config/env";

const prometheusBaseUrl = (env as any).PROMETHEUS_URL;

const getApplicationMetrics = asyncHandler(
	async (req: Request, res: Response) => {
		const app = await Application.findById(req.params.id);
		if (!app) {
			log({ type: "error", message: "Application not found" });
			return res
				.status(404)
				.json(formatNotification("Application not found", "error"));
		}
		const namespace = app.namespace || "default";
		const deploymentName = app.deploymentName || app.name;
		// Prometheus pod name pattern: deploymentName-xxxx
		const podRegex = `${deploymentName}-.*`;
		const queries = {
			cpu: `sum(rate(container_cpu_usage_seconds_total{namespace="${namespace}", pod=~"${podRegex}"}[5m]))`,
			memory: `sum(container_memory_usage_bytes{namespace="${namespace}", pod=~"${podRegex}"})`,
			storage: `sum(container_fs_usage_bytes{namespace="${namespace}", pod=~"${podRegex}"})`,
		};
		const end = Math.floor(Date.now() / 1000);
		const start = end - 3600; // last 1 hour
		const step = 60; // 1-minute intervals
		const results: Record<string, any> = {};
		for (const [key, query] of Object.entries(queries)) {
			const instantUrl = `${prometheusBaseUrl}/api/v1/query?query=${encodeURIComponent(
				query
			)}`;
			const rangeUrl = `${prometheusBaseUrl}/api/v1/query_range?query=${encodeURIComponent(
				query
			)}&start=${start}&end=${end}&step=${step}`;
			try {
				const [instantRes, rangeRes] = await Promise.all([
					axios.get(instantUrl),
					axios.get(rangeUrl),
				]);
				results[key] = {
					current: instantRes.data.data.result?.[0]?.value?.[1]
						? Number(
								Number(instantRes.data.data.result[0].value[1]).toFixed(3)
						  ).toLocaleString(undefined, { maximumFractionDigits: 3 })
						: null,
					history: rangeRes.data.data.result?.[0]?.values
						? rangeRes.data.data.result[0].values.map(
								([ts, val]: [number, string]) => [
									ts,
									Number(Number(val).toFixed(3)).toLocaleString(undefined, {
										maximumFractionDigits: 3,
									}),
								]
						  )
						: [],
				};
			} catch {
				results[key] = { current: null, history: [] };
			}
		}
		// Return metrics and resource requests/limits
		res.json({
			metrics: results,
			resources: {
				requests: {
					cpuMilli: app.resources?.requests?.cpuMilli || null,
					memoryMB: app.resources?.requests?.memoryMB || null,
					storageGB: app.resources?.requests?.storageGB || null,
				},
				limits: {
					cpuMilli: app.resources?.limits?.cpuMilli || null,
					memoryMB: app.resources?.limits?.memoryMB || null,
					storageGB: app.resources?.limits?.storageGB || null,
				},
			},
		});
	}
);

export default getApplicationMetrics;
