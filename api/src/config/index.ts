// src/config/index.ts
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const {
  PORT = 5000,
  MONGO_URI,
  SESSION_SECRET,
  FRONTEND_URL = "http://localhost:3000",
  NODE_ENV,
  GITHUB_APP_ID,
  GITHUB_APP_SLUG,
  GITHUB_PRIVATE_KEY,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} = process.env;
