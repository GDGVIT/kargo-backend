import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";

export async function runDockerScript(
  gitHubUrl: string
): Promise<{ dockerfile?: string; dockerCompose?: string; error?: string }> {
  const scriptPath = path.resolve(__dirname, "../../../AI/docker.py");
  const outputPath = path.resolve(__dirname, "../../../AI/output");
  return new Promise((resolve, reject) => {
    const python = spawn("python", ["-u", scriptPath, gitHubUrl]);
    let stderr = "";
    python.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    python.on("close", async (code) => {
      if (code !== 0 || stderr) {
        return resolve({ error: stderr || `Python exited with code ${code}` });
      }
      try {
        const [dockerfile, dockerCompose] = await Promise.all([
          fs.readFile(path.join(outputPath, "Dockerfile"), "utf-8"),
          fs.readFile(path.join(outputPath, "docker-compose.yml"), "utf-8"),
        ]);
        resolve({ dockerfile, dockerCompose });
      } catch (err) {
        resolve({ error: "Failed to read Dockerfile or docker-compose.yml" });
      }
    });
  });
}
