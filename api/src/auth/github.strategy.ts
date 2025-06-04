import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import User from "../models/user.model";

export function setupGitHubStrategy() {
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
          let user = await User.findOne({ "oauth.githubId": profile.id });
          if (user) return done(null, user);

          const email = profile.emails?.[0].value;
          if (email) {
            user = await User.findOne({ email });
            if (user) {
              user.oauth = { ...user.oauth, githubId: profile.id };
              await user.save();
              return done(null, user);
            }
          }

          const newUser = await User.create({
            email,
            name: profile.displayName,
            profilePicture: profile.photos?.[0]?.value,
            oauth: { githubId: profile.id },
          });
          return done(null, newUser);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}
