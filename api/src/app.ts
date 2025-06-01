import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import { FRONTEND_URL } from "./config";
import { sessionMiddleware } from "./config/session";
import "./config/passport";
import authRoutes from "./routes/auth.routes";
import githubRoutes from "./routes/github.routes";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();

app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", FRONTEND_URL);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.sendStatus(200);
});

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

app.use("/api/auth", authRoutes);
app.use("/api/github", githubRoutes);

app.get("/", (_req, res) => {
  res.json({ message: "API is running", uptime: Math.round(process.uptime()) });
});

app.use(errorHandler);

export default app;
