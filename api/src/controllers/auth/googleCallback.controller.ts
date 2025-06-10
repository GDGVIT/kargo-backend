import { Request, Response } from "express";
import passport from "passport";
import env from "../../config/env";

const googleCallback = [
  passport.authenticate("google", { failureRedirect: "/login?error=google" }),
  (_req: Request, res: Response) => {
    res.redirect(env.FRONTEND_URL + "/profile");
  },
];

export default googleCallback;
