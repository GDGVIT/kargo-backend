import { Router } from "express";
import passport from "passport";
import { Request, Response } from "express";
import {
  register,
  login,
  logout,
  googleAuth,
  googleCallback,
  getMe,
  setUsername,
  verifyEmail,
} from "../controllers/auth.controller";

const router = Router();

const githubAuth = passport.authenticate("github", { scope: ["user:email"] });
const githubCallback = [
  passport.authenticate("github", { failureRedirect: "/" }),
  (_req: Request, res: Response) => {
    res.redirect(
      (process.env.FRONTEND_URL || "http://localhost:3000") + "/profile"
    );
  },
];

router.post("/register", (req, res, next) => {
  register(req, res, next);
});
router.post("/login", login);
router.post("/logout", logout);
router.get("/google", googleAuth);
router.get("/google/callback", ...googleCallback);
router.get("/me", getMe);
router.post("/set-username", (req, res, next) => {
  setUsername(req, res, next);
});
router.get("/github", githubAuth);
router.get("/github/callback", ...githubCallback);
router.get("/verify-email", (req, res, next) => {
  Promise.resolve(verifyEmail(req, res)).catch(next);
});

export default router;
