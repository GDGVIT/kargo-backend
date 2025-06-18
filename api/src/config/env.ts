import path from "path";
import dotenv from "dotenv";
import { log } from "../utils/logging/logger";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const REQUIRED_ENV_VARS = [
  "MONGO_URI",
  "SESSION_SECRET",
  "NEXTAUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GITHUB_APP_ID",
  "GITHUB_APP_SLUG",
  "GITHUB_PRIVATE_KEY",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "INGRESS_BASE_DOMAIN",
  "MANIFESTS_DIR",
  "GROQ",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
];

const env = {
  // Node environment (development, production, etc.)
  NODE_ENV: process.env.NODE_ENV || "development",

  // MongoDB connection string
  MONGO_URI: process.env.MONGO_URI,

  // Frontend URL (used for CORS, redirects, etc.)
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",

  // Session and authentication secrets
  SESSION_SECRET: process.env.SESSION_SECRET,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,

  // OAuth credentials for Google
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

  // OAuth credentials for GitHub
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,

  // GitHub App credentials
  GITHUB_APP_ID: process.env.GITHUB_APP_ID,
  GITHUB_APP_SLUG: process.env.GITHUB_APP_SLUG,
  GITHUB_PRIVATE_KEY: (process.env.GITHUB_PRIVATE_KEY || "").replace(
    /\\n/g,
    "\n"
  ),

  // SMTP configuration for sending emails
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM,
  CUSTOM_DOMAIN: process.env.CUSTOM_DOMAIN || "kargo.upayan.dev",

  // Ingress domains
  INGRESS_BASE_DOMAIN: process.env.INGRESS_BASE_DOMAIN,

  // Directory for manifests
  MANIFESTS_DIR: process.env.MANIFESTS_DIR,

  // GROQ API key or endpoint
  GROQ: process.env.GROQ,

  // Razorpay
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
};

const missingVars = REQUIRED_ENV_VARS.filter(
  (key) => !env[key as keyof typeof env]
);
if (missingVars.length > 0) {
  log({
    type: "error",
    message: `Missing required environment variables: ${missingVars.join(
      ", "
    )}`,
  });
  throw new Error(
    `Missing required environment variables: ${missingVars.join(", ")}`
  );
}

export default env;
