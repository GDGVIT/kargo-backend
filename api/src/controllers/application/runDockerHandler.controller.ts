import { Request, Response } from "express";
import { runDockerScript } from "../../utils/k8s/docker-file";
import { log, formatNotification } from "../../utils/logging/logger";

const runDockerHandler = async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url || typeof url !== "string") {
    log({ type: "error", message: "Missing or invalid 'url' in body." });
    return res
      .status(400)
      .json(formatNotification("Missing or invalid 'url' in body.", "error"));
  }
  try {
    runDockerScript(url).then((result) => {
      if (result.error) {
        log({ type: "error", message: `Docker script error: ${result.error}` });
        return res.status(500).json(formatNotification(result.error, "error"));
      }
      log({
        type: "success",
        message: "Dockerfile and Compose generated successfully",
      });
      res.status(200).json({
        ...formatNotification(
          "Dockerfile and Compose generated successfully",
          "success"
        ),
        dockerfile: result.dockerfile,
        dockerCompose: result.dockerCompose,
      });
    });
  } catch (error: any) {
    log({ type: "error", message: "Python script failed.", meta: error });
    res.status(500).json(formatNotification("Python script failed.", "error"));
  }
};

export default runDockerHandler;
