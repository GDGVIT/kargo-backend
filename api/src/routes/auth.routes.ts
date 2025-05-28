import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import passport from "passport";
import User from "../models/user.model";

const router = Router();

router.post("/register", (req: Request, res: Response) => {
  (async () => {
    try {
      const { email, password, name, username } = req.body;

      const usernameRegex = /^[A-Za-z0-9_-]+$/;
      if (
        username &&
        (typeof username !== "string" ||
          username.trim().length === 0 ||
          !usernameRegex.test(username))
      ) {
        return res.status(400).json({
          message:
            "Invalid username. Only alphabets, numbers, underscores, and hyphens are allowed. No spaces.",
        });
      }

      const existing = await User.findOne({ email });
      if (existing)
        return res.status(400).json({ message: "User already exists" });

      // Gravatar URL
      const crypto = require("crypto");
      const hash = crypto
        .createHash("md5")
        .update(email.trim().toLowerCase())
        .digest("hex");
      const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?d=identicon`;

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await User.create({
        email,
        password: hashedPassword,
        name,
        username,
        profilePicture: gravatarUrl,
      });

      req.login(newUser, (err: any) => {
        if (err)
          return res
            .status(500)
            .json({ message: "Login after register failed" });
        const safeUser = { ...newUser.toObject() };
        delete safeUser.password;
        return res.json({
          message: "Registered and logged in",
          user: safeUser,
        });
      });
    } catch (err) {
      res.status(500).json({ message: "Registration failed", error: err });
    }
  })();
});

router.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) {
        console.error("Authentication error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
      if (!user) {
        return res
          .status(401)
          .json({ message: info?.message || "Invalid credentials" });
      }
      req.logIn(user, (err: any) => {
        if (err) {
          return res.status(500).json({ message: "Login failed" });
        }
        const userObj = { ...user.toObject?.() };
        if (userObj.password) delete userObj.password;
        res.json({ user: userObj });
      });
    })(req, res, next);
  }
);

router.post("/logout", (req: Request, res: Response) => {
  req.logout((err: any) => {
    if (err) return res.status(500).json({ message: "Logout failed" });
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out" });
  });
});

router.get(
  "/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (_req: Request, res: Response) => {
    res.redirect(process.env.FRONTEND_URL || "http://localhost:3000");
  }
);

router.get("/me", (req: Request, res: Response) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const user = { ...(req.user as any) };
    if (user.password) delete user.password;
    res.json({ user });
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
});

router.post("/set-username", (req: Request, res: Response) => {
  (async () => {
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = req.user as any;
    if (user.username) {
      return res.status(400).json({ message: "Username already set" });
    }
    const { username } = req.body;
    const usernameRegex = /^[A-Za-z0-9_-]+$/;
    if (
      !username ||
      typeof username !== "string" ||
      username.trim().length === 0 ||
      !usernameRegex.test(username)
    ) {
      return res.status(400).json({
        message:
          "Invalid username. Only alphabets, numbers, underscores, and hyphens are allowed. No spaces.",
      });
    }
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ message: "Username already taken" });
    }
    try {
      user.username = username;
      await user.save();
      const safeUser = { ...(user.toObject?.() || user) };
      if (safeUser.password) delete safeUser.password;
      return res.json({
        message: "Username set successfully",
        user: safeUser,
      });
    } catch (err) {
      return res
        .status(500)
        .json({ message: "Failed to set username", error: err });
    }
  })();
});

export default router;
