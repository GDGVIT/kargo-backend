import { Request, Response } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import User from "../models/user.model";

const { GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_PRIVATE_KEY } = process.env;

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

export const githubInstall = (_req: Request, res: Response) => {
  res.redirect(`https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`);
};

export const githubCallback = async (req: Request, res: Response) => {
  const installationId = req.body.installation_id as string;
  const user = await getUserFromSession(req);

  if (!user || !installationId) {
    return res.status(400).send("Missing user session or installation ID.");
  }

  try {
    if (!user.githubInstallationId?.includes(installationId)) {
      user.githubInstallationId = user.githubInstallationId || [];
      user.githubInstallationId.push(installationId);
      await user.save();
    }
    res.status(200).json({ message: "GitHub installation saved." });
  } catch (err) {
    console.error("Error saving installation ID:", err);
    res.status(500).send("Failed to save installation ID.");
  }
};

export const githubRepos = async (req: Request, res: Response) => {
  try {
    let installationIds: string[] = [];

    if (req.query.installation_ids) {
      installationIds = (req.query.installation_ids as string).split(",");
    } else {
      const user = await getUserFromSession(req);
      if (
        !user?.githubInstallationId ||
        user.githubInstallationId.length === 0
      ) {
        return res.status(400).json({ error: "GitHub not connected for user" });
      }
      installationIds = user.githubInstallationId;
    }

    if (!Array.isArray(installationIds) || installationIds.length === 0) {
      return res
        .status(400)
        .json({ error: "Invalid or missing installation IDs" });
    }

    const jwtToken = createGitHubJwt();
    let allRepos: any[] = [];

    for (const installationId of installationIds) {
      // Get access token for the installation
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

      // Get repositories for this installation
      const reposResponse = await axios.get(
        "https://api.github.com/installation/repositories",
        {
          headers: {
            Authorization: `token ${accessToken}`,
            Accept: "application/vnd.github+json",
          },
        }
      );

      // Extract and extend repo info
      const repos = reposResponse.data.repositories || [];
      const extendedRepos = repos.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        html_url: repo.html_url,
        description: repo.description,
        private: repo.private,
        fork: repo.fork,
        owner_login: repo.owner?.login,
        forks_count: repo.forks_count,
        stargazers_count: repo.stargazers_count,
        watchers_count: repo.watchers_count,
        language: repo.language,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
        pushed_at: repo.pushed_at,
        license: repo.license ? repo.license.spdx_id : null,
        open_issues_count: repo.open_issues_count,
      }));

      allRepos = allRepos.concat(extendedRepos);
    }

    res.json({ repositories: allRepos });
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
};

export const githubInstallationId = async (req: Request, res: Response) => {
  const user = await getUserFromSession(req);
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json({ installation_ids: user.githubInstallationId || [] });
};

export const githubSaveInstallationId = async (req: Request, res: Response) => {
  const { installation_id } = req.body;
  const user = await getUserFromSession(req);

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (!installation_id) {
    return res.status(400).json({ error: "Missing installation ID" });
  }

  try {
    if (!user.githubInstallationId?.includes(installation_id)) {
      user.githubInstallationId = user.githubInstallationId || [];
      user.githubInstallationId.push(installation_id);
      await user.save();
    }
    res.status(200).json({ message: "Installation ID saved." });
  } catch (err) {
    console.error("Error saving installation ID:", err);
    res.status(500).json({ error: "Failed to save installation ID." });
  }
};
