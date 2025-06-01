import session from "express-session";
import MongoStore from "connect-mongo";
import { SESSION_SECRET, NODE_ENV, MONGO_URI } from "./index";

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET is not defined");
}

export const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    ttl: 60 * 60 * 24 * 7, // 7 days
  }),
  cookie: {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: NODE_ENV === "production" ? "strict" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  },
});
