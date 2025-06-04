import path from "path";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import "./auth/passport";
import "./auth/local.strategy";

import authRoutes from "./routes/auth.routes";
import githubRoutes from "./routes/github.routes";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const frontendUrl = process.env.FRONTEND_URL;
const production = process.env.NODE_ENV === "production";

if (production) {
  app.set("trust proxy", 1);
}

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  })
);

app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET is not set in environment variables.");
}

app.use(
  session({
    name: "kargo.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: production,
      sameSite: production ? "none" : "lax",
      domain: production ? ".kargo.upayan.dev" : undefined,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "API is running",
    uptime: Math.round(process.uptime()),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/github", githubRoutes);

export default app;
