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
        if (!user) return done(null, false, { message: "Incorrect email." });
        if (!user.password)
          return done(null, false, {
            message: "No password set for this user.",
          });
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid)
          return done(null, false, { message: "Incorrect password." });

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);
