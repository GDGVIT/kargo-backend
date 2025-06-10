import passport from "passport";

const githubAuth = passport.authenticate("github", {
  scope: ["user:email"],
});

export default githubAuth;
