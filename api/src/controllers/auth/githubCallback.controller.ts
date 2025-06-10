import { Request, Response } from "express";
import passport from "passport";

const githubCallback = [
  passport.authenticate("github", { failureRedirect: "/login?error=github" }),
  (_req: Request, res: Response) => {
    res.redirect(
      (process.env.FRONTEND_URL || "http://localhost:3000") + "/profile"
    );
  },
];

export default githubCallback;
