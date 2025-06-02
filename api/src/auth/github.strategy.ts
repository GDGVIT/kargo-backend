import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import User from "../models/user.model";
import dotenv from "dotenv";

dotenv.config();

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL: "/api/auth/github/callback",
      scope: ["user:email"],
    },
    async (
      _accessToken: string,
      _refreshToken: string,
      profile: any,
      done: (error: any, user?: any) => void
    ) => {
      try {
        // Find user by githubId in oauth subfield
        let user = await User.findOne({ "oauth.githubId": profile.id });
        if (user) return done(null, user);

        // If not found, create new user
        user = await User.create({
          email: profile.emails?.[0].value,
          name: profile.displayName,
          profilePicture: profile.photos?.[0]?.value,
          oauth: { githubId: profile.id },
        });
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);
