import { runDockerScript } from "./docker-file";
(async () => {
  const result = await runDockerScript("https://github.com/swayam5342/ieeeras_task_1_backend");

  if (result.error) {
    console.error("Error:", result.error);
  } else {
    console.log("Dockerfile:\n", result.dockerfile);
    console.log("Compose:\n", result.dockerCompose);
  }
})();
