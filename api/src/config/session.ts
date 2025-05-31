import session from "express-session";
import { SESSION_SECRET, NODE_ENV } from "./index";

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET is not defined");
}

export const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: NODE_ENV === "production" ? "strict" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  },
});
