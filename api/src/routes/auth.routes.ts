import { Router, Response, NextFunction } from "express";
import asyncHandler from "../utils/handlers/asyncHandler";
import register from "../controllers/auth/register.controller";
import login from "../controllers/auth/login.controller";
import logout from "../controllers/auth/logout.controller";
import googleAuth from "../controllers/auth/googleAuth.controller";
import googleCallback from "../controllers/auth/googleCallback.controller";
import githubAuth from "../controllers/auth/githubAuth.controller";
import githubCallback from "../controllers/auth/githubCallback.controller";
import getMe from "../controllers/auth/getMe.controller";
import setUsername from "../controllers/auth/setUsername.controller";
import verifyEmail from "../controllers/auth/verifyEmail.controller";
import resendVerification from "../controllers/auth/resendVerification.controller";
import ensureAuthenticated from "../utils/auth/ensureAuthenticated";

const router = Router();

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.post("/logout", logout);
router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);
router.get("/github", githubAuth);
router.get("/github/callback", githubCallback);
router.get("/me", ensureAuthenticated, asyncHandler(getMe));
router.post("/set-username", asyncHandler(setUsername));
router.get("/verify-email", asyncHandler(verifyEmail));
router.post("/resend-verification", asyncHandler(resendVerification));

export default router;
