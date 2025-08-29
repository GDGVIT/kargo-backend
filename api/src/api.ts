import express, { Request, Response } from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes";
import githubRoutes from "./routes/github.routes";
import applicationRoutes from "./routes/application.routes";
import userRoutes from "./routes/user.routes";
import planRoutes from "./routes/plan.routes";
import metricsRoutes from "./routes/metrics.routes";
import log from "./utils/logging/logger";
import env from "./config/env";
import "./auth/passport";
import "./auth/local.strategy";

const app = express();
const frontendUrl = env.FRONTEND_URL;
const production = env.NODE_ENV === "production";

if (production) {
  app.set("trust proxy", 1);
}

log({
  type: "info",
  message: `Server starting at ${new Date().toISOString()} | ENV: ${
    env.NODE_ENV
  }`,
});

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  })
);

app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

const sessionSecret = env.SESSION_SECRET;
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
      sameSite: "lax",
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
app.use("/api/applications", applicationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/metrics", metricsRoutes);

export default app;
