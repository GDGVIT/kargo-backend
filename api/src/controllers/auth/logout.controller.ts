import { Request, Response } from "express";
import { log, formatNotification } from "../../utils/logging/logger";
import env from "../../config/env";

const logout = (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      log({ type: "error", message: "Logout failed", meta: err });
      return res.status(500).json(formatNotification("Logout failed", "error"));
    }

    res.clearCookie("connect.sid", {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
    });

    log({ type: "success", message: "User logged out" });
    res.json(formatNotification("Logged out", "success"));
  });
};

export default logout;
