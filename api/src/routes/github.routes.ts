import { Router, Request, Response } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import User from "../models/user.model";

const router = Router();

const {
  GITHUB_APP_ID,
  GITHUB_APP_SLUG,
  GITHUB_PRIVATE_KEY,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
} = process.env;

if (!GITHUB_APP_ID || !GITHUB_APP_SLUG || !GITHUB_PRIVATE_KEY) {
  throw new Error(
    "Missing essential GitHub App env vars: GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_PRIVATE_KEY"
  );
}

const privateKey = GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n");

router.get("/install", (_req: Request, res: Response) => {
  const installUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`;
  return res.redirect(installUrl);
});

router.post("/callback", async (req: Request, res: Response) => {
  const installationId = req.body.installation_id as string;
  const user = req.user;

  if (!user || !installationId) {
    res.status(400).send("Missing user session or installation ID.");
    return;
  }

  try {
    const dbUser = await User.findById((user as any)._id);
    if (!dbUser) {
      res.status(404).send("User not found");
      return;
    }

    dbUser.githubInstallationId = installationId;
    await dbUser.save();

    res.status(200).json({ message: "GitHub installation saved." });
  } catch (err) {
    console.error("Error saving installation ID:", err);
    res.status(500).send("Failed to save installation ID.");
  }
});

router.get("/repos", async (req: Request, res: Response) => {
  try {
    let installationId = req.query.installation_id as string | undefined;

    if (!installationId) {
      if (!req.user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const user = await User.findById((req.user as any)._id);
      installationId = user?.githubInstallationId;

      if (!installationId) {
        res.status(400).json({ error: "GitHub not connected for user" });
        return;
      }
    }

    if (typeof installationId !== "string") {
      res.status(400).json({ error: "Invalid installation ID" });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60,
      exp: now + 540,
      iss: GITHUB_APP_ID,
    };
    const jwtToken = jwt.sign(payload, privateKey, { algorithm: "RS256" });

    const tokenResponse = await axios.post(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {},
      {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    const accessToken = tokenResponse.data.token;

    const reposResponse = await axios.get(
      "https://api.github.com/installation/repositories",
      {
        headers: {
          Authorization: `token ${accessToken}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    res.json(reposResponse.data);
  } catch (error: any) {
    console.error(
      "GitHub /repos error:",
      error.response?.data || error.message
    );
    res.status(500).json({
      error:
        error.response?.data?.message ||
        error.message ||
        "Internal Server Error",
    });
  }
});

router.get("/installation_id", async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const user = await User.findById((req.user as any)._id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ installation_id: user.githubInstallationId || null });
  } catch (err) {
    console.error("Error fetching installation ID:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/installation-id", async (req: Request, res: Response) => {
  const { installation_id } = req.body;

  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!installation_id) {
    res.status(400).json({ error: "Missing installation ID" });
    return;
  }

  try {
    const user = await User.findById((req.user as any)._id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    user.githubInstallationId = installation_id;
    await user.save();

    res.status(200).json({ message: "Installation ID saved." });
  } catch (err) {
    console.error("Error saving installation ID:", err);
    res.status(500).json({ error: "Failed to save installation ID." });
  }
});

export default router;
