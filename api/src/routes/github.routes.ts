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

// ✅ Install URL redirect
router.get("/install", (_req: Request, res: Response) => {
  const installUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`;
  return res.redirect(installUrl);
});

// ✅ GitHub OAuth callback — saves installationId to logged-in user
router.get("/callback", (req: Request, res: Response, next) => {
  (async () => {
    const installationId = req.query.installation_id as string;
    const user = req.user;

    if (!user || !installationId) {
      return res.status(400).send("Missing user session or installation ID.");
    }

    try {
      const dbUser = await User.findById((user as any)._id);
      if (!dbUser) return res.status(404).send("User not found");

      dbUser.githubInstallationId = installationId;
      await dbUser.save();

      return res.send(
        "GitHub App installed successfully! You can close this window."
      );
    } catch (err) {
      console.error("Error saving installation ID:", err);
      return res.status(500).send("Failed to save installation ID.");
    }
  })().catch(next);
});

// ✅ Fetch GitHub repositories using installation access token
router.get("/repos", (req: Request, res: Response, next) => {
  (async () => {
    let installationId = req.query.installation_id as string | undefined;

    if (!installationId) {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await User.findById((req.user as any)._id);
      installationId = user?.githubInstallationId;

      if (!installationId) {
        return res.status(400).json({ error: "GitHub not connected for user" });
      }
    }

    if (typeof installationId !== "string") {
      return res.status(400).json({ error: "Invalid installation ID" });
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

    return res.json(reposResponse.data);
  })().catch((error) => {
    console.error(
      "GitHub /repos error:",
      error.response?.data || error.message
    );
    return res.status(500).json({
      error:
        error.response?.data?.message ||
        error.message ||
        "Internal Server Error",
    });
  });
});

export default router;
