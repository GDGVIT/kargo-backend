export function parseResource(val: string | undefined) {
  if (!val) return 0;
  if (val.endsWith("m")) return parseInt(val) / 1000;
  if (val.endsWith("Mi")) return parseInt(val);
  if (val.endsWith("Gi")) return parseInt(val) * 1024;
  return parseFloat(val);
}

interface ResourceQuota {
  requests: {
    cpu?: string;
    memory?: string;
  };
  limits: {
    cpu?: string;
    memory?: string;
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
  const userModel = await (await import("../models/user.model")).default
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
        cpu: parseResource(planResources.requests?.cpu) + parseResource(extra.requests?.cpu),
        memory: parseResource(planResources.requests?.memory) + parseResource(extra.requests?.memory),
      },
      limits: {
        cpu: parseResource(planResources.limits?.cpu) + parseResource(extra.limits?.cpu),
        memory: parseResource(planResources.limits?.memory) + parseResource(extra.limits?.memory),
      },
    };

    const ApplicationModel = (await import("../models/application.model")).default;
    const apps = await ApplicationModel.find({
      owner,
      _id: { $ne: req.params.id },
    });
    const usage = {
      requests: { cpu: 0, memory: 0 },
      limits: { cpu: 0, memory: 0 },
    };
    for (const app of apps) {
      usage.requests.cpu += parseResource(app.resources?.requests?.cpu);
      usage.requests.memory += parseResource(app.resources?.requests?.memory);
      usage.limits.cpu += parseResource(app.resources?.limits?.cpu);
      usage.limits.memory += parseResource(app.resources?.limits?.memory);
    }

    usage.requests.cpu += parseResource(resources.requests?.cpu);
    usage.requests.memory += parseResource(resources.requests?.memory);
    usage.limits.cpu += parseResource(resources.limits?.cpu);
    usage.limits.memory += parseResource(resources.limits?.memory);

    if (
      usage.requests.cpu > allowed.requests.cpu ||
      usage.requests.memory > allowed.requests.memory ||
      usage.limits.cpu > allowed.limits.cpu ||
      usage.limits.memory > allowed.limits.memory
    ) {
      return { allowed, usage, exceeded: true };
    }
  }
  return { exceeded: false };
}