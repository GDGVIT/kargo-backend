import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.model";
import dotenv from "dotenv";
import "./github.strategy";

dotenv.config();

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: "/api/auth/google/callback",
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        // Find user by Google ID in oauth subfield
        const existingUser = await User.findOne({
          "oauth.googleId": profile.id,
        });

        if (existingUser) return done(null, existingUser);

        const newUser = await User.create({
          oauth: { googleId: profile.id },
          email: profile.emails?.[0].value,
          name: profile.displayName,
          profilePicture: profile.photos?.[0]?.value,
          username: undefined,
        });

        done(null, newUser);
      } catch (err) {
        done(err);
      }
    }
  )
);
