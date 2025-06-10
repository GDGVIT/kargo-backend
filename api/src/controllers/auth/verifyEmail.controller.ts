import { Request, Response } from "express";
import User from "../../models/user.model";
import { log, formatNotification } from "../../utils/logging/logger";

const verifyEmail = async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    log({ type: "error", message: "Invalid or missing verification token." });
    return res
      .status(400)
      .json(
        formatNotification("Invalid or missing verification token.", "error")
      );
  }

  const user = await User.findOne({ verificationToken: token });

  if (!user) {
    log({ type: "error", message: "Invalid or expired verification token." });
    return res
      .status(400)
      .json(
        formatNotification(
          "Invalid or expired verification token. Please request a new one.",
          "error"
        )
      );
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  await user.save();

  log({ type: "success", message: `Email verified for user: ${user.email}` });
  return res.json(
    formatNotification(
      "Email verified successfully! You can now log in.",
      "success"
    )
  );
};

export default verifyEmail;
