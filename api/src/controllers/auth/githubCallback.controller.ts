import { Request, Response } from "express";
import passport from "passport";
import env from "../../config/env";

const githubCallback = [
  passport.authenticate("github", { failureRedirect: "/login?error=github" }),
  (_req: Request, res: Response) => {
    res.redirect((env.FRONTEND_URL || "http://localhost:3000") + "/profile");
  },
];

export default githubCallback;
