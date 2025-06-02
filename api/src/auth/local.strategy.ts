import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import User from "../models/user.model";

passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email });
        if (!user) return done(null, false, { message: "Incorrect email" });

        // Only allow local login if password is set
        if (!user.password) {
          return done(null, false, {
            message:
              "Please login with OAuth and set a password to enable email login.",
          });
        }

        const valid = await bcrypt.compare(password, user.password || "");
        if (!valid) return done(null, false, { message: "Incorrect password" });

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);
