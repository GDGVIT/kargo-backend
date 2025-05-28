import path from "path";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "API is running",
    uptime: Math.round(process.uptime()),
  });
});

export default app;
