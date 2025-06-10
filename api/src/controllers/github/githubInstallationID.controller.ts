import { Request, Response } from "express";
import { log, formatNotification } from "../../utils/logging/logger";
import getUserFromSession from "../../utils/github/getUserFromSession";

const githubInstallationId = async (req: Request, res: Response) => {
  const user = await getUserFromSession(req);
  if (!user) {
    log({ type: "error", message: "Not authenticated" });
    return res
      .status(401)
      .json(formatNotification("Not authenticated", "error"));
  }
  res.json({ installation_ids: user.githubInstallationId || [] });
};

export default githubInstallationId;
