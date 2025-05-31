import path from "path";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import cookieParser from "cookie-parser";
import "./auth/passport";
import "./auth/local.strategy";
import authRoutes from "./routes/auth.routes";
import githubRoutes from "./routes/github.routes";

// Load environment variables early
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  console.error("SESSION_SECRET is not set in environment variables.");
  process.exit(1);
}

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
console.log("CORS enabled for:", FRONTEND_URL);

app.use(express.json());
app.use(cookieParser());

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Secure cookies in production
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // Stricter in production
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get("/", (_req, res) => {
  res.json({
    message: "API is running",
    uptime: Math.round(process.uptime()),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/github", githubRoutes);

export default app;
