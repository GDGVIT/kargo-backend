import { spawn } from "child_process";
import path from "path";
export function runDockerScript(
  gitHubUrl: string
): Promise<{ dockerfile?: string; dockerCompose?: string; error?: string }> {
  // Corrected path to AI/docker.py (relative to project root)
  const scriptPath = path.resolve(__dirname, "../../../AI/docker.py");

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const python = spawn("python", ["-u", scriptPath, gitHubUrl]);

    python.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    python.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0 || stderr) {
        return resolve({ error: stderr || `Python exited with code ${code}` });
      }
      // Try to extract Dockerfile and docker-compose from stdout
      const dockerfileMatch = stdout.match(/```dockerfile([\s\S]*?)```/i);
      const composeMatch = stdout.match(/```yml([\s\S]*?)```/i);
      const dockerfile = dockerfileMatch
        ? dockerfileMatch[1].trim()
        : undefined;
      const dockerCompose = composeMatch ? composeMatch[1].trim() : undefined;
      if (!dockerfile && !dockerCompose) {
        return resolve({
          error: "No Dockerfile or docker-compose.yml generated.",
        });
      }
      resolve({ dockerfile, dockerCompose });
    });
  });
}
