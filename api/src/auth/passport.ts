import passport from "passport";
import User from "../models/user.model";
import { setupGitHubStrategy } from "./github.strategy";
import { setupGoogleStrategy } from "./google.strategy";
import { log } from "../utils/logging/logger";

setupGitHubStrategy();
setupGoogleStrategy();

passport.serializeUser((user: any, done) => {
  try {
    done(null, user.id);
  } catch (err) {
    log({ type: "error", message: "Error in serializeUser", meta: err });
    done(err);
  }
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    log({ type: "error", message: "Error in deserializeUser", meta: err });
    done(err);
  }
});
