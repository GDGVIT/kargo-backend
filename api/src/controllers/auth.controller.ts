import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import passport from "passport";
import crypto from "crypto";
import User from "../models/user.model";
import Plan from "../models/plan.model";
import { sendVerificationEmail } from "../utils/verification";

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
      return res
        .status(400)
        .json({ message: "Please provide email, password, and name." });
    }

    if (username && !isValidUsername(username)) {
      return res.status(400).json({
        message:
          "Invalid username. Only letters, numbers, underscores, and hyphens are allowed. No spaces.",
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({
        message:
          "An account with this email already exists. Please log in or use a different email.",
      });
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

    res.json({
      message:
        "Registration successful! Please check your email to verify your account before logging in.",
    });
  } catch (err) {
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
            return reject(err);
          }
          if (!user) {
            return res.status(401).json({
              message:
                info?.message || "Invalid email or password. Please try again.",
            });
          }
          req.logIn(user, (err) => {
            if (err) {
              return reject(err);
            }
            res.json({
              user: sanitizeUser(user),
              message: "Login successful!",
            });
            resolve();
          });
        }
      )(req, res, next);
    });
  } catch (err) {
    next(err);
  }
};

export const logout = (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ message: "Logout failed" });

    res.clearCookie("connect.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.json({ message: "Logged out" });
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
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user: sanitizeUser(user) });
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
};

export const setUsername = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.isAuthenticated?.() || !req.user) {
      return res
        .status(401)
        .json({ message: "You must be logged in to set a username." });
    }

    const user = req.user as any;

    if (user.username) {
      return res
        .status(400)
        .json({ message: "Username is already set and cannot be changed." });
    }

    const { username } = req.body;

    if (!username || !isValidUsername(username)) {
      return res.status(400).json({
        message:
          "Invalid username. Only letters, numbers, underscores, and hyphens are allowed. No spaces.",
      });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({
        message: "This username is already taken. Please choose another.",
      });
    }

    user.username = username;
    await user.save();

    return res.json({
      message: "Username set successfully!",
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    return res
      .status(400)
      .json({ message: "Invalid or missing verification token." });
  }

  const user = await User.findOne({ verificationToken: token });

  if (!user) {
    return res.status(400).json({
      message:
        "Invalid or expired verification token. Please request a new one.",
    });
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  await user.save();

  return res.json({
    message: "Email verified successfully! You can now log in.",
  });
};

export const resendVerification = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ message: "Please provide your email address." });
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res
      .status(400)
      .json({ message: "No account found with this email address." });
  }

  if (user.isVerified) {
    return res
      .status(400)
      .json({ message: "This email is already verified. Please log in." });
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
