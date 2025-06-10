import { Request, Response } from "express";
import { log, formatNotification } from "../../utils/logging/logger";
import getUserFromSession from "../../utils/github/getUserFromSession";

const githubCallback = async (req: Request, res: Response) => {
  const installationId = req.body.installation_id as string;
  const user = await getUserFromSession(req);

  if (!user || !installationId) {
    log({ type: "error", message: "Missing user session or installation ID." });
    return res
      .status(400)
      .json(
        formatNotification("Missing user session or installation ID.", "error")
      );
  }

  try {
    if (!user.githubInstallationId?.includes(installationId)) {
      user.githubInstallationId = user.githubInstallationId || [];
      user.githubInstallationId.push(installationId);
      await user.save();
    }
    log({
      type: "success",
      message: `GitHub installation saved for user: ${user.email}`,
    });
    res
      .status(200)
      .json(formatNotification("GitHub installation saved.", "success"));
  } catch (err) {
    log({ type: "error", message: "Error saving installation ID", meta: err });
    res
      .status(500)
      .json(formatNotification("Failed to save installation ID.", "error"));
  }
};

export default githubCallback;
