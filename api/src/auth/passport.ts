import passport from "passport";
import User from "../models/user.model";
import { setupGitHubStrategy } from "./github.strategy";
import { setupGoogleStrategy } from "./google.strategy";

// Register all strategies in one place for modularity
setupGitHubStrategy();
setupGoogleStrategy();

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
