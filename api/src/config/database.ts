import mongoose from "mongoose";
import { MONGO_URI } from "./index";

export const connectDatabase = async () => {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is not defined");
  }
  await mongoose.connect(MONGO_URI);
  console.log("MongoDB connected");
};
