import path from "path";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import cookieParser from "cookie-parser";
import "./auth/passport";
import "./auth/local.strategy";
import authRoutes from "./routes/auth.routes";
import githubRoutes from "./routes/github.routes";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();

// Middleware: CORS
const frontendUrl = process.env.FRONTEND_URL;
app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  })
);
console.log("CORS enabled for:", frontendUrl);

// Middleware: JSON and cookies
app.use(express.json());
app.use(cookieParser());

// Middleware: Session
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET is not set in environment variables.");
}

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    },
  })
);

// Middleware: Passport
app.use(passport.initialize());
app.use(passport.session());

// Health check route
app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "API is running",
    uptime: Math.round(process.uptime()),
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/github", githubRoutes);

export default app;
