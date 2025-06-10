import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import passport from "passport";
import crypto from "crypto";
import User from "../models/user.model";
import Plan from "../models/plan.model";
import { sendVerificationEmail } from "../utils/verification";
import { log, formatNotification } from "../utils/logger";
import type { IUser } from "../types/user.types";
import type { Document } from "mongoose";

function isValidUsername(username: string): boolean {
  const usernameRegex = /^[A-Za-z0-9_-]+$/;
  return (
    typeof username === "string" &&
    username.trim().length > 0 &&
    usernameRegex.test(username)
  );
}

function sanitizeUser(user: any): Partial<IUser> {
  const safeUser = { ...(user.toObject?.() || user) };
  if (safeUser.password) delete safeUser.password;
  if (safeUser.verificationToken) delete safeUser.verificationToken;
  return safeUser;
}

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password, name, username } = req.body;

    if (!email || !password || !name) {
      log({
        type: "error",
        message: "Please provide email, password, and name.",
      });
      return res
        .status(400)
        .json(
          formatNotification(
            "Please provide email, password, and name.",
            "error"
          )
        );
    }

    if (username && !isValidUsername(username)) {
      log({ type: "error", message: "Invalid username format." });
      return res
        .status(400)
        .json(
          formatNotification(
            "Invalid username. Only letters, numbers, underscores, and hyphens are allowed. No spaces.",
            "error"
          )
        );
    }

    const existing = await User.findOne({ email });
    if (existing) {
      log({
        type: "warning",
        message: `Account with email ${email} already exists.`,
      });
      return res
        .status(400)
        .json(
          formatNotification(
            "An account with this email already exists. Please log in or use a different email.",
            "warning"
          )
        );
    }

    const hash = crypto
      .createHash("md5")
      .update(email.trim().toLowerCase())
      .digest("hex");

    const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?d=identicon`;
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const basePlan = await Plan.findOne({ isDefault: true });

    const newUser = await User.create({
      email,
      password: hashedPassword,
      name,
      username,
      profilePicture: gravatarUrl,
      isVerified: false,
      verificationToken,
      plan: basePlan ? basePlan._id : undefined,
    });

    await sendVerificationEmail({
      to: email,
      token: verificationToken,
      domain: process.env.CUSTOM_DOMAIN || "http://localhost:3000",
      name,
    });

    log({ type: "success", message: `User registered: ${email}` });
    res.json(
      formatNotification(
        "Registration successful! Please check your email to verify your account before logging in.",
        "success"
      )
    );
  } catch (err) {
    log({ type: "error", message: "Registration failed", meta: err });
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await new Promise<void>((resolve, reject) => {
      passport.authenticate(
        "local",
        (err: any, user: Express.User, info: { message: any }) => {
          if (err) {
            log({ type: "error", message: "Login error", meta: err });
            return reject(err);
          }
          if (!user) {
            log({
              type: "error",
              message: info?.message || "Invalid email or password.",
            });
            return res
              .status(401)
              .json(
                formatNotification(
                  info?.message ||
                    "Invalid email or password. Please try again.",
                  "error"
                )
              );
          }
          req.logIn(user, (err) => {
            if (err) {
              log({ type: "error", message: "Login error", meta: err });
              return reject(err);
            }
            log({
              type: "success",
              message: `User logged in: ${user && (user as any).email}`,
            });
            res.json({
              user: sanitizeUser(user),
              ...formatNotification("Login successful!", "success"),
            });
            resolve();
          });
        }
      )(req, res, next);
    });
  } catch (err) {
    log({ type: "error", message: "Login failed", meta: err });
    next(err);
  }
};

export const logout = (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      log({ type: "error", message: "Logout failed", meta: err });
      return res.status(500).json(formatNotification("Logout failed", "error"));
    }

    res.clearCookie("connect.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    log({ type: "success", message: "User logged out" });
    res.json(formatNotification("Logged out", "success"));
  });
};

export const googleAuth = passport.authenticate("google", {
  scope: ["email", "profile"],
});

export const googleCallback = [
  passport.authenticate("google", { failureRedirect: "/" }),
  (_req: Request, res: Response) => {
    res.redirect(
      (process.env.FRONTEND_URL || "http://localhost:3000") + "/profile"
    );
  },
];

export const getMe = async (req: Request, res: Response) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const user = await User.findById((req.user as any)._id).populate("plan");
    if (!user) {
      log({ type: "error", message: "User not found" });
      return res
        .status(404)
        .json(formatNotification("User not found", "error"));
    }
    res.json({ user: sanitizeUser(user) });
  } else {
    log({ type: "error", message: "Not authenticated" });
    res.status(401).json(formatNotification("Not authenticated", "error"));
  }
};

export const setUsername = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.isAuthenticated?.() || !req.user) {
      log({
        type: "error",
        message: "You must be logged in to set a username.",
      });
      return res
        .status(401)
        .json(
          formatNotification(
            "You must be logged in to set a username.",
            "error"
          )
        );
    }

    const user = req.user as IUser & Document;

    if (user.username) {
      log({
        type: "warning",
        message: "Username is already set and cannot be changed.",
      });
      return res
        .status(400)
        .json(
          formatNotification(
            "Username is already set and cannot be changed.",
            "warning"
          )
        );
    }

    const { username } = req.body;

    if (!username || !isValidUsername(username)) {
      log({ type: "error", message: "Invalid username format." });
      return res
        .status(400)
        .json(
          formatNotification(
            "Invalid username. Only letters, numbers, underscores, and hyphens are allowed. No spaces.",
            "error"
          )
        );
    }

    const existing = await User.findOne({ username });
    if (existing) {
      log({ type: "warning", message: "This username is already taken." });
      return res
        .status(400)
        .json(
          formatNotification(
            "This username is already taken. Please choose another.",
            "warning"
          )
        );
    }

    user.username = username;
    await user.save();

    log({ type: "success", message: `Username set for user: ${user.email}` });
    return res.json({
      ...formatNotification("Username set successfully!", "success"),
      user: sanitizeUser(user),
    });
  } catch (err) {
    log({ type: "error", message: "Failed to set username", meta: err });
    next(err);
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    log({ type: "error", message: "Invalid or missing verification token." });
    return res
      .status(400)
      .json(
        formatNotification("Invalid or missing verification token.", "error")
      );
  }

  const user = await User.findOne({ verificationToken: token });

  if (!user) {
    log({ type: "error", message: "Invalid or expired verification token." });
    return res
      .status(400)
      .json(
        formatNotification(
          "Invalid or expired verification token. Please request a new one.",
          "error"
        )
      );
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  await user.save();

  log({ type: "success", message: `Email verified for user: ${user.email}` });
  return res.json(
    formatNotification(
      "Email verified successfully! You can now log in.",
      "success"
    )
  );
};

export const resendVerification = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    log({ type: "error", message: "Please provide your email address." });
    return res
      .status(400)
      .json(formatNotification("Please provide your email address.", "error"));
  }

  const user = await User.findOne({ email });

  if (!user) {
    log({
      type: "error",
      message: "No account found with this email address.",
    });
    return res
      .status(400)
      .json(
        formatNotification("No account found with this email address.", "error")
      );
  }

  if (user.isVerified) {
    log({ type: "warning", message: "This email is already verified." });
    return res
      .status(400)
      .json(
        formatNotification(
          "This email is already verified. Please log in.",
          "warning"
        )
      );
  }

  const token = crypto.randomBytes(32).toString("hex");
  user.verificationToken = token;
  await user.save();

  await sendVerificationEmail({
    to: user.email,
    token,
    domain: process.env.CUSTOM_DOMAIN || "http://localhost:3000",
    name: user.name,
  });

  res.json({
    message: "Verification email resent! Please check your inbox.",
  });
};
