import { Request, Response } from "express";
import passport from "passport";

const googleCallback = [
  passport.authenticate("google", { failureRedirect: "/login?error=google" }),
  (_req: Request, res: Response) => {
    res.redirect(
      (process.env.FRONTEND_URL || "http://localhost:3000") + "/profile"
    );
  },
];

export default googleCallback;
