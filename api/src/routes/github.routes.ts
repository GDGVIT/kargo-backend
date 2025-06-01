import { Router, Request, Response } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import User from "../models/user.model";

const router = Router();

const {
  GITHUB_APP_ID,
  GITHUB_APP_SLUG,
  GITHUB_PRIVATE_KEY,
} = process.env;

if (!GITHUB_APP_ID || !GITHUB_APP_SLUG || !GITHUB_PRIVATE_KEY) {
  throw new Error(
    "Missing essential GitHub App env vars: GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_PRIVATE_KEY"
  );
}

const privateKey = GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n");

async function getUserFromSession(req: Request) {
  if (!req.user) return null;
  return User.findById((req.user as any)._id);
}

function createGitHubJwt() {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iat: now - 60,
      exp: now + 540,
      iss: GITHUB_APP_ID,
    },
    privateKey,
    { algorithm: "RS256" }
  );
}

router.get("/install", (_req, res) => {
  res.redirect(`https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`);
});

// Route: Save installation ID to user
router.post("/callback", async (req: Request, res: Response) => {
  const installationId = req.body.installation_id as string;
  const user = await getUserFromSession(req);

  if (!user || !installationId) {
    return res.status(400).send("Missing user session or installation ID.");
  }

  try {
    user.githubInstallationId = installationId;
    await user.save();
    res.status(200).json({ message: "GitHub installation saved." });
  } catch (err) {
    console.error("Error saving installation ID:", err);
    res.status(500).send("Failed to save installation ID.");
  }
});

// Route: Get repositories for installation
router.get("/repos", async (req: Request, res: Response) => {
  try {
    let installationId = req.query.installation_id as string | undefined;

    if (!installationId) {
      const user = await getUserFromSession(req);
      installationId = user?.githubInstallationId;
      if (!installationId) {
        return res.status(400).json({ error: "GitHub not connected for user" });
      }
    }

    if (typeof installationId !== "string") {
      return res.status(400).json({ error: "Invalid installation ID" });
    }

    const jwtToken = createGitHubJwt();

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
    console.error("GitHub /repos error:", error.response?.data || error.message);
    res.status(500).json({
      error:
        error.response?.data?.message ||
        error.message ||
        "Internal Server Error",
    });
  }
});

// Route: Get user's installation ID
router.get("/installation_id", async (req: Request, res: Response) => {
  const user = await getUserFromSession(req);
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json({ installation_id: user.githubInstallationId || null });
});

// Route: Save installation ID to user
router.post("/installation-id", async (req: Request, res: Response) => {
  const { installation_id } = req.body;
  const user = await getUserFromSession(req);

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (!installation_id) {
    return res.status(400).json({ error: "Missing installation ID" });
  }

  try {
    user.githubInstallationId = installation_id;
    await user.save();
    res.status(200).json({ message: "Installation ID saved." });
  } catch (err) {
    console.error("Error saving installation ID:", err);
    res.status(500).json({ error: "Failed to save installation ID." });
  }
});

export default router;
