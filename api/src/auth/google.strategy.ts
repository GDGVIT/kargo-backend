import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.model";

export function setupGoogleStrategy() {
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
          let user = await User.findOne({ "oauth.googleId": profile.id });
          if (user) return done(null, user);

          // Try to find user by email
          const email = profile.emails?.[0].value;
          if (email) {
            user = await User.findOne({ email });
            if (user) {
              // Link Google to existing user
              user.oauth = { ...user.oauth, googleId: profile.id };
              await user.save();
              return done(null, user);
            }
          }

          // If not found, create new user
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
}
