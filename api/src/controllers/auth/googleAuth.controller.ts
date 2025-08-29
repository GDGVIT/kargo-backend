import passport from "passport";

const googleAuth = passport.authenticate("google", {
  scope: ["email", "profile"],
});

export default googleAuth;
