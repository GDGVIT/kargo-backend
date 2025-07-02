import { Request, Response } from "express";
import Application from "../../models/application.model";
import User from "../../models/user.model";

export default async function getUserSettingsStats(
  req: Request,
  res: Response
) {
  const userId = (req.user && (req.user as any)._id) || (req as any).userId;
  if (!userId) {
    return res.status(400).json({ message: "User id required" });
  }

  const applications = await Application.find({ owner: userId });
  const numServers = applications.length;

  let numPorts = 0;
  let numEnvVars = 0;

  applications.forEach((app) => {
    numPorts += Array.isArray(app.ports) ? app.ports.length : 0;
    numEnvVars += app.env ? Object.keys(app.env).length : 0;
  });

  const user = await User.findById(userId);
  const numCreds = user?.credentials?.length || 0;

  res.json({
    servers: numServers,
    ports: numPorts,
    envVars: numEnvVars,
    creds: numCreds,
  });
}
