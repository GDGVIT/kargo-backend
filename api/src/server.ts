import path from "path";
import dotenv from "dotenv";

// Load environment variables early
const envPath = path.resolve(__dirname, "../../.env");
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error("Failed to load .env file at", envPath);
  process.exit(1);
}

import mongoose from "mongoose";
import app from "./app";

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("MONGO_URI is not set in environment variables.");
  process.exit(1);
}

async function startServer() {
  try {
    await mongoose.connect(MONGO_URI!); // Non-null assertion since we already checked above
    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API URL: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
