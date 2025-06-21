import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.model";
import Plan from "../models/plan.model";
import log from "../utils/logging/logger";
import env from "../config/env";

export function setupGoogleStrategy() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID!,
        clientSecret: env.GOOGLE_CLIENT_SECRET!,
        callbackURL: "/api/auth/google/callback",
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ "oauth.googleId": profile.id });
          if (user) {
            log({
              type: "success",
              message: `Google login: existing user ${user.email}`,
            });
            return done(null, user);
          }

          const email = profile.emails?.[0].value;
          if (email) {
            user = await User.findOne({ email });
            if (user) {
              user.oauth = { ...user.oauth, googleId: profile.id };
              await user.save();
              log({
                type: "success",
                message: `Google login: linked Google to existing user ${user.email}`,
              });
              return done(null, user);
            }
          }

          const basePlan = await Plan.findOne({ isDefault: true });
          const newUser = await User.create({
            oauth: { googleId: profile.id },
            email: profile.emails?.[0].value,
            name: profile.displayName,
            profilePicture: profile.photos?.[0]?.value,
            username: undefined,
            plan: basePlan ? basePlan._id : undefined,
          });
          log({
            type: "success",
            message: `Google login: new user created ${newUser.email}`,
          });
          done(null, newUser);
        } catch (err) {
          log({ type: "error", message: "GoogleStrategy error", meta: err });
          done(err);
        }
      }
    )
  );
}
