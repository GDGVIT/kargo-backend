import { spawn } from "child_process";
import path from "path";
export function runDockerScript(gitHubUrl: string): void {
  const scriptPath = path.resolve("../../../AI/dokcer.py");

  const python = spawn("python", ["-u", scriptPath, gitHubUrl]);

  python.stdout.on("data", (data) => {
    process.stdout.write(`[stdout] ${data}`);
  });

  python.stderr.on("data", (data) => {
    process.stderr.write(`[stderr] ${data}`);
  });

  python.on("close", (code) => {
    console.log(`\n[exit] Python process exited with code ${code}`);
  });
}
