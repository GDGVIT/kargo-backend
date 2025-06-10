import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../../models/user.model";
import Plan from "../../models/plan.model";
import { sendVerificationEmail } from "../../utils/verification";
import { log, formatNotification } from "../../utils/logger";
import isValidUsername from "../../utils/auth/isValidUsername";

const register = async (req: Request, res: Response, next: NextFunction) => {
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

export default register;
