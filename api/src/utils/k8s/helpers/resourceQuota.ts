export function parseResource(val: string | number | undefined) {
	if (val === undefined || val === null || val === "") return 0;
	if (typeof val === "number") return val;
	if (typeof val !== "string") return 0;
	if (val.endsWith("m")) return parseInt(val) / 1000;
	if (val.endsWith("Mi")) return parseInt(val);
	if (val.endsWith("Gi")) return parseInt(val) * 1024;
	return parseFloat(val);
}

interface ResourceQuota {
	requests: {
		cpuMilli?: string;
		memoryMB?: string;
	};
	limits: {
		cpuMilli?: string;
		memoryMB?: string;
	};
}

interface CheckResourceQuotaResult {
	allowed?: ResourceQuota;
	usage?: ResourceQuota;
	exceeded: boolean;
}

export async function checkResourceQuota({
	resources,
	owner,
	req,
}: {
	resources: ResourceQuota;
	owner: string;
	req: any;
}): Promise<CheckResourceQuotaResult> {
	const userModel = await (await import("../../../models/user.model")).default
		.findById(owner)
		.populate("plan");
	if (userModel) {
		let planResources: ResourceQuota = { requests: {}, limits: {} };
		if (
			userModel.plan &&
			typeof userModel.plan === "object" &&
			"resources" in userModel.plan
		) {
			planResources = (userModel.plan as any).resources || {};
		}
		const extra = userModel.extraResources || {};
		const allowed = {
			requests: {
				cpuMilli: (
					parseResource(planResources.requests?.cpuMilli) +
					parseResource(extra.requests?.cpuMilli)
				).toString(),
				memoryMB: (
					parseResource(planResources.requests?.memoryMB) +
					parseResource(extra.requests?.memoryMB)
				).toString(),
			},
			limits: {
				cpuMilli: (
					parseResource(planResources.limits?.cpuMilli) +
					parseResource(extra.limits?.cpuMilli)
				).toString(),
				memoryMB: (
					parseResource(planResources.limits?.memoryMB) +
					parseResource(extra.limits?.memoryMB)
				).toString(),
			},
		};

		const ApplicationModel = (await import("../../../models/application.model"))
			.default;
		const apps = await ApplicationModel.find({
			owner,
			_id: { $ne: req.params.id },
		});
		const usage = {
			requests: { cpu: 0, memory: 0 },
			limits: { cpu: 0, memory: 0 },
		};
		for (const app of apps) {
			usage.requests.cpu += parseResource(app.resources?.requests?.cpuMilli);
			usage.requests.memory += parseResource(app.resources?.requests?.memoryMB);
			usage.limits.cpu += parseResource(app.resources?.limits?.cpuMilli);
			usage.limits.memory += parseResource(app.resources?.limits?.memoryMB);
		}

		usage.requests.cpu += parseResource(resources.requests?.cpuMilli);
		usage.requests.memory += parseResource(resources.requests?.memoryMB);
		usage.limits.cpu += parseResource(resources.limits?.cpuMilli);
		usage.limits.memory += parseResource(resources.limits?.memoryMB);

		const usageString: ResourceQuota = {
			requests: {
				cpuMilli: usage.requests.cpu.toString(),
				memoryMB: usage.requests.memory.toString(),
			},
			limits: {
				cpuMilli: usage.limits.cpu.toString(),
				memoryMB: usage.limits.memory.toString(),
			},
		};

		if (
			usage.requests.cpu > parseFloat(allowed.requests.cpuMilli) ||
			usage.requests.memory > parseFloat(allowed.requests.memoryMB) ||
			usage.limits.cpu > parseFloat(allowed.limits.cpuMilli) ||
			usage.limits.memory > parseFloat(allowed.limits.memoryMB)
		) {
			return { allowed, usage: usageString, exceeded: true };
		}
	}
	return { exceeded: false };
}
