import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import passport from "passport";
import User from "../models/user.model";
import crypto from "crypto";

const router = Router();


function isValidUsername(username: string): boolean {
  const usernameRegex = /^[A-Za-z0-9_-]+$/;
  return (
    typeof username === "string" &&
    username.trim().length > 0 &&
    usernameRegex.test(username)
  );
}


function sanitizeUser(user: any) {
  const safeUser = { ...(user.toObject?.() || user) };
  if (safeUser.password) delete safeUser.password;
  return safeUser;
}

// Register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name, username } = req.body;

    if (username && !isValidUsername(username)) {
      return res.status(400).json({
        message:
          "Invalid username. Only alphabets, numbers, underscores, and hyphens are allowed. No spaces.",
      });
    }

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "User already exists" });

    // Gravatar URL
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
      return res.json({
        message: "Registered and logged in",
        user: sanitizeUser(newUser),
      });
    });
  } catch (err) {
    res.status(500).json({ message: "Registration failed", error: err });
  }
});

// Login
router.post(
  "/login",
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
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
        res.json({ user: sanitizeUser(user) });
      });
    })(req, res, next);
  }
);

// Logout
router.post("/logout", (req: Request, res: Response) => {
  req.logout((err: any) => {
    if (err) return res.status(500).json({ message: "Logout failed" });
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out" });
  });
});

// Google OAuth
router.get(
  "/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (_req: Request, res: Response) => {
    res.redirect(
      (process.env.FRONTEND_URL || "http://localhost:3000") + "/profile"
    );
  }
);

// Get current user
router.get("/me", (req: Request, res: Response) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.json({ user: sanitizeUser(req.user) });
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
});

// Set username
router.post("/set-username", async (req: Request, res: Response) => {
  if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const user = req.user as any;
  if (user.username) {
    return res.status(400).json({ message: "Username already set" });
  }
  const { username } = req.body;
  if (!isValidUsername(username)) {
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
    return res.json({
      message: "Username set successfully",
      user: sanitizeUser(user),
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Failed to set username", error: err });
  }
});

export default router;
