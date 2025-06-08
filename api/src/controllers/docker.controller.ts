import express, { Request, Response } from "express";
import { runDockerScript } from "../utils/dokcerFile";

const app = express();
const port = 3000;

app.use(express.json());

app.post("/run-docker", async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'url' in body." });
  }
  try {
    await runDockerScript(url);
    res.status(200).json({ message: "Python script executed successfully." });
  } catch (error: any) {
    console.error("[run-docker:error]", error.message);
    res.status(500).json({ error: "Python script failed.", detail: error.message });
  }
});

