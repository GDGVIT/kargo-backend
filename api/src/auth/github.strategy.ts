import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import User from "../models/user.model";
import Plan from "../models/plan.model";
import log from "../utils/logging/logger";
import env from "../config/env";

export function setupGitHubStrategy() {
  passport.use(
    new GitHubStrategy(
      {
        clientID: env.GITHUB_CLIENT_ID!,
        clientSecret: env.GITHUB_CLIENT_SECRET!,
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
          if (user) {
            log({
              type: "success",
              message: `GitHub login: existing user ${user.email}`,
            });
            return done(null, user);
          }

          const email = profile.emails?.[0].value;
          if (email) {
            user = await User.findOne({ email });
            if (user) {
              user.oauth = { ...user.oauth, githubId: profile.id };
              await user.save();
              log({
                type: "success",
                message: `GitHub login: linked GitHub to existing user ${user.email}`,
              });
              return done(null, user);
            }
          }

          const basePlan = await Plan.findOne({ isDefault: true });
          const newUser = await User.create({
            email,
            name: profile.displayName,
            profilePicture: profile.photos?.[0]?.value,
            oauth: { githubId: profile.id },
            plan: basePlan ? basePlan._id : undefined,
          });
          log({
            type: "success",
            message: `GitHub login: new user created ${newUser.email}`,
          });
          return done(null, newUser);
        } catch (err) {
          log({ type: "error", message: "GitHubStrategy error", meta: err });
          return done(err);
        }
      }
    )
  );
}
