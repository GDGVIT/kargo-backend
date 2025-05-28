import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import passport from "passport";
import User from "../models/user.model";

const router = Router();

router.post("/register", (req: Request, res: Response) => {
  (async () => {
    try {
      const { email, password } = req.body;

      const existing = await User.findOne({ email });
      if (existing)
        return res.status(400).json({ message: "User already exists" });

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await User.create({ email, password: hashedPassword });

      req.login(newUser, (err: any) => {
        if (err)
          return res
            .status(500)
            .json({ message: "Login after register failed" });
        return res.json({ message: "Registered and logged in", user: newUser });
      });
    } catch (err) {
      res.status(500).json({ message: "Registration failed", error: err });
    }
  })();
});

router.post("/login", (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate("local", (err: any, user: any, info: any) => {
    if (err || !user)
      return res.status(401).json({ message: info?.message || "Login failed" });

    req.logIn(user, (err: any) => {
      if (err) return res.status(500).json({ message: "Login error" });
      return res.json({ message: "Logged in", user });
    });
  })(req, res, next);
});

router.post("/logout", (req: Request, res: Response) => {
  req.logout((err: any) => {
    if (err) return res.status(500).json({ message: "Logout failed" });
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out" });
  });
});

router.get(
  "/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (_req: Request, res: Response) => {
    res.redirect(process.env.FRONTEND_URL || "http://localhost:3000");
  }
);

router.get("/me", (req: Request, res: Response) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const user = { ...req.user } as any;
    if (user.password) delete user.password;
    res.json({ user });
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
});

export default router;
