import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import User from "../models/user.model";
import Plan from "../models/plan.model";
import { log } from "../utils/logger";

passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email });
        if (!user) {
          log({
            type: "error",
            message: `Login failed: Incorrect email (${email})`,
          });
          return done(null, false, { message: "Incorrect email" });
        }

        if (!user.password) {
          log({
            type: "error",
            message: `Login failed: Email/password login not enabled for ${email}`,
          });
          return done(null, false, {
            message:
              "Email/password login is not enabled for your account. Please continue using OAuth to sign in.",
          });
        }

        if (!user.isVerified) {
          log({
            type: "warning",
            message: `Login failed: Email not verified for ${email}`,
          });
          return done(null, false, {
            message: "Please verify your email before logging in.",
          });
        }

        const valid = await bcrypt.compare(password, user.password || "");
        if (!valid) {
          log({
            type: "error",
            message: `Login failed: Incorrect password for ${email}`,
          });
          return done(null, false, { message: "Incorrect password" });
        }

        if (!user.plan) {
          const basePlan = await Plan.findOne({ isDefault: true });
          if (basePlan) {
            user.plan = basePlan._id;
            await user.save();
          }
        }

        log({ type: "success", message: `User logged in: ${email}` });
        return done(null, user);
      } catch (error) {
        log({ type: "error", message: "LocalStrategy error", meta: error });
        return done(error);
      }
    }
  )
);
