import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import mongoose from "mongoose";
import app from "./app";
import { log } from "./utils/logger";

const PORT = 5000;

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    log({ type: "success", message: "MongoDB connected" });

    app.listen(PORT, () => {
      log({ type: "success", message: `Server running on port ${PORT}` });
      log({ type: "info", message: `API URL: http://localhost:${PORT}` });
    });
  } catch (err) {
    log({ type: "error", message: "Server failed to start", meta: err });
    process.exit(1);
  }
}

startServer();
