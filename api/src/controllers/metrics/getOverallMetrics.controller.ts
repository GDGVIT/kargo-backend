import { Request, Response } from "express";
import axios from "axios";
import env from "../../config/env";
import asyncHandler from "../../utils/handlers/asyncHandler";

const prometheusBaseUrl = (env as any).PROMETHEUS_URL;

const queries = {
	cpu: 'sum(rate(node_cpu_seconds_total{mode!="idle"}[5m]))',
	memory: "sum(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes)",
	storage: 'sum(node_filesystem_size_bytes{fstype!~"tmpfs|overlay"})',
	pods: "count(kube_pod_info)",
	network_rx: 'sum(rate(node_network_receive_bytes_total{device!="lo"}[5m]))',
	network_tx: 'sum(rate(node_network_transmit_bytes_total{device!="lo"}[5m]))',
	nodes: "count(kube_node_info)",
	apiserver_uptime: 'time() - kube_pod_start_time{pod=~"kube-apiserver.*"}',
};

const getOverallMetrics = asyncHandler(async (_req: Request, res: Response) => {
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
				current: instantRes.data.data.result?.[0]?.value?.[1] ?? null,
				history: rangeRes.data.data.result?.[0]?.values ?? [],
			};
		} catch {
			results[key] = { current: null, history: [] };
		}
	}

	res.json({ metrics: results });
});

export default getOverallMetrics;
