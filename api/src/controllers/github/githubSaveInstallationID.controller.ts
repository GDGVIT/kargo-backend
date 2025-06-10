import { Request, Response } from "express";
import { log, formatNotification } from "../../utils/logging/logger";
import getUserFromSession from "../../utils/github/getUserFromSession";

const githubSaveInstallationID = async (req: Request, res: Response) => {
  const { installation_id } = req.body;
  const user = await getUserFromSession(req);

  if (!user) {
    log({ type: "error", message: "Not authenticated" });
    return res
      .status(401)
      .json(formatNotification("Not authenticated", "error"));
  }
  if (!installation_id) {
    log({ type: "error", message: "Missing installation ID" });
    return res
      .status(400)
      .json(formatNotification("Missing installation ID", "error"));
  }

  try {
    if (!user.githubInstallationId?.includes(installation_id)) {
      user.githubInstallationId = user.githubInstallationId || [];
      user.githubInstallationId.push(installation_id);
      await user.save();
    }
    log({
      type: "success",
      message: `Installation ID saved for user: ${user.email}`,
    });
    res
      .status(200)
      .json(formatNotification("Installation ID saved.", "success"));
  } catch (err) {
    log({ type: "error", message: "Error saving installation ID", meta: err });
    res
      .status(500)
      .json(formatNotification("Failed to save installation ID.", "error"));
  }
};

export default githubSaveInstallationID;
