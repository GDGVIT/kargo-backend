import { Request, Response, NextFunction } from "express";
import User from "../../models/user.model";
import log, { formatNotification } from "../../utils/logging/logger";

// Get total resource usage and allowed for a user
const getUserResourceUsage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId =
      (req.user &&
        ("id" in req.user ? (req.user as any).id : (req.user as any)._id)) ||
      req.params.id;
    if (!userId) {
      log({ type: "error", message: "User id required" });
      return res
        .status(400)
        .json(formatNotification("User id required", "error"));
    }
    // Get user with plan and extraResources
    const user = await User.findById(userId).populate("plan");
    if (!user) {
      log({ type: "error", message: "User not found" });
      return res
        .status(404)
        .json(formatNotification("User not found", "error"));
    }
    // Calculate allowed resources (plan + extraResources)
    let planResources: any = {};
    if (
      user.plan &&
      typeof user.plan === "object" &&
      "resources" in user.plan
    ) {
      planResources = (user.plan as any).resources || {};
    }
    const extra = user.extraResources || {};
    function parse(val: string | number | undefined | null): number {
      if (val === undefined || val === null || val === "") return 0;
      if (typeof val === "number") return val;
      if (typeof val !== "string") return 0;
      if (val.endsWith("m")) return parseInt(val) / 1000;
      if (val.endsWith("Mi")) return parseInt(val);
      if (val.endsWith("Gi")) return parseInt(val) * 1024;
      return parseFloat(val);
    }
    const allowed = {
      requests: {
        cpu: parse(planResources.requests?.cpu) + parse(extra.requests?.cpu),
        memory:
          parse(planResources.requests?.memory) + parse(extra.requests?.memory),
        storage:
          parse(planResources.requests?.storage) +
          parse(extra.requests?.storage),
      },
      limits: {
        cpu: parse(planResources.limits?.cpu) + parse(extra.limits?.cpu),
        memory:
          parse(planResources.limits?.memory) + parse(extra.limits?.memory),
        storage:
          parse(planResources.limits?.storage) + parse(extra.limits?.storage),
      },
    };
    // Sum all app resource usage for this user
    const userIdForQuery = (user as any)._id || (user as any).id || user.id;
    const apps = await (
      await import("../../models/application.model")
    ).default.find({ owner: userIdForQuery });
    const usage = {
      requests: { cpu: 0, memory: 0, storage: 0 },
      limits: { cpu: 0, memory: 0, storage: 0 },
    };
    for (const app of apps) {
      usage.requests.cpu += parse(app.resources?.requests?.cpu);
      usage.requests.memory += parse(app.resources?.requests?.memory);
      usage.requests.storage += parse(app.resources?.requests?.storage);
      usage.limits.cpu += parse(app.resources?.limits?.cpu);
      usage.limits.memory += parse(app.resources?.limits?.memory);
      usage.limits.storage += parse(app.resources?.limits?.storage);
    }
    return res.json({ allowed, usage });
  } catch (err) {
    log({
      type: "error",
      message: "Failed to get user resource usage",
      meta: err,
    });
    next(err);
  }
};

export default getUserResourceUsage;
