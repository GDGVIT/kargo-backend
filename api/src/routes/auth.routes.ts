import { Router } from "express";
import passport from "passport";
import { asyncHandler } from "../utils/asyncHandler";
import {
  register,
  login,
  logout,
  googleAuth,
  googleCallback,
  getMe,
  setUsername,
  verifyEmail,
  resendVerification,
} from "../controllers/auth.controller";

const router = Router();

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.post("/logout", logout);
router.get("/google", googleAuth);
router.get("/google/callback", ...googleCallback);
router.get("/me", getMe);
router.post("/set-username", asyncHandler(setUsername));
router.get("/verify-email", asyncHandler(verifyEmail));
router.post("/resend-verification", asyncHandler(resendVerification));

router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] })
);
router.get(
  "/github/callback",
  passport.authenticate("github", { failureRedirect: "/login?error=github" }),
  (_req, res) => {
    res.redirect(
      (process.env.FRONTEND_URL || "http://localhost:3000") + "/profile"
    );
  }
);

export default router;
