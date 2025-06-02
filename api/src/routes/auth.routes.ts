import { Router } from "express";
import {
  register,
  login,
  logout,
  googleAuth,
  googleCallback,
  getMe,
  setUsername,
} from "../controllers/auth.controller";

const router = Router();

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

export default router;
