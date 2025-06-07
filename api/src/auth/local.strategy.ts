import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import User from "../models/user.model";
import Plan from "../models/plan.model";

passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email });
        if (!user) return done(null, false, { message: "Incorrect email" });

        if (!user.password) {
          return done(null, false, {
            message:
              "Please login with OAuth and set a password to enable email login.",
          });
        }

        if (!user.isVerified) {
          return done(null, false, {
            message: "Please verify your email before logging in.",
          });
        }

        const valid = await bcrypt.compare(password, user.password || "");
        if (!valid) return done(null, false, { message: "Incorrect password" });

        if (!user.plan) {
          const basePlan = await Plan.findOne({ isDefault: true });
          if (basePlan) {
            user.plan = basePlan._id as string;
            await user.save();
          }
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);
