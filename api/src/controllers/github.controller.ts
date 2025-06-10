import { Request, Response } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import User from "../models/user.model";
import { log, formatNotification } from "../utils/logger";

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
    log({ type: "error", message: "Missing user session or installation ID." });
    return res
      .status(400)
      .json(
        formatNotification("Missing user session or installation ID.", "error")
      );
  }

  try {
    if (!user.githubInstallationId?.includes(installationId)) {
      user.githubInstallationId = user.githubInstallationId || [];
      user.githubInstallationId.push(installationId);
      await user.save();
    }
    log({
      type: "success",
      message: `GitHub installation saved for user: ${user.email}`,
    });
    res
      .status(200)
      .json(formatNotification("GitHub installation saved.", "success"));
  } catch (err) {
    log({ type: "error", message: "Error saving installation ID", meta: err });
    res
      .status(500)
      .json(formatNotification("Failed to save installation ID.", "error"));
  }
};

export const githubRepos = async (req: Request, res: Response) => {
  try {
    let installationIds: string[] = [];
    let user = null;

    if (req.query.installation_ids) {
      installationIds = (req.query.installation_ids as string).split(",");
    } else {
      user = await getUserFromSession(req);
      if (
        !user?.githubInstallationId ||
        user.githubInstallationId.length === 0
      ) {
        log({ type: "warning", message: "GitHub not connected for user" });
        return res
          .status(400)
          .json(formatNotification("GitHub not connected for user", "warning"));
      }
      installationIds = user.githubInstallationId;
    }

    if (!Array.isArray(installationIds) || installationIds.length === 0) {
      log({ type: "error", message: "Invalid or missing installation IDs" });
      return res
        .status(400)
        .json(
          formatNotification("Invalid or missing installation IDs", "error")
        );
    }

    const jwtToken = createGitHubJwt();
    let allRepos: any[] = [];
    let removedInstallationIds: string[] = [];
    let userChanged = false;

    for (const installationId of installationIds) {
      try {
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

        // Fetch all pages of repos for this installation
        let page = 1;
        let repos: any[] = [];
        let hasMore = true;
        while (hasMore) {
          const reposResponse = await axios.get(
            "https://api.github.com/installation/repositories",
            {
              headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/vnd.github+json",
              },
              params: {
                per_page: 100,
                page,
              },
            }
          );
          const pageRepos = reposResponse.data.repositories || [];
          repos = repos.concat(pageRepos);
          if (pageRepos.length < 100) {
            hasMore = false;
          } else {
            page++;
          }
        }
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
      } catch (error: any) {
        // If 404, remove the installationId from user and DB
        if (
          error.response &&
          error.response.status === 404 &&
          user &&
          user.githubInstallationId?.includes(installationId)
        ) {
          user.githubInstallationId = user.githubInstallationId.filter(
            (id: string) => id !== installationId
          );
          removedInstallationIds.push(installationId);
          userChanged = true;
        } else {
          throw error;
        }
      }
    }

    if (userChanged && user) {
      await user.save();
    }

    if (removedInstallationIds.length > 0) {
      log({
        type: "warning",
        message:
          "Some GitHub installations were invalid and have been removed.",
      });
      return res.status(400).json({
        ...formatNotification(
          "Some GitHub installations were invalid and have been removed. Please reconnect GitHub if needed.",
          "warning"
        ),
        removedInstallationIds,
      });
    }

    log({
      type: "success",
      message: `Fetched ${allRepos.length} GitHub repositories`,
    });
    res.json({ repositories: allRepos });
  } catch (error: any) {
    log({
      type: "error",
      message: "GitHub /repos error",
      meta: error.response?.data || error.message,
    });
    res
      .status(500)
      .json(
        formatNotification(
          error.response?.data?.message ||
            error.message ||
            "Internal Server Error",
          "error"
        )
      );
  }
};

export const githubInstallationId = async (req: Request, res: Response) => {
  const user = await getUserFromSession(req);
  if (!user) {
    log({ type: "error", message: "Not authenticated" });
    return res
      .status(401)
      .json(formatNotification("Not authenticated", "error"));
  }
  res.json({ installation_ids: user.githubInstallationId || [] });
};

export const githubSaveInstallationId = async (req: Request, res: Response) => {
  const { installation_id } = req.body;
  const user = await getUserFromSession(req);

  if (!user) {
    log({ type: "error", message: "Not authenticated" });
    return res
      .status(401)
      .json(formatNotification("Not authenticated", "error"));
  }
  if (!installation_id) {
    log({ type: "error", message: "Missing installation ID" });
    return res
      .status(400)
      .json(formatNotification("Missing installation ID", "error"));
  }

  try {
    if (!user.githubInstallationId?.includes(installation_id)) {
      user.githubInstallationId = user.githubInstallationId || [];
      user.githubInstallationId.push(installation_id);
      await user.save();
    }
    log({
      type: "success",
      message: `Installation ID saved for user: ${user.email}`,
    });
    res
      .status(200)
      .json(formatNotification("Installation ID saved.", "success"));
  } catch (err) {
    log({ type: "error", message: "Error saving installation ID", meta: err });
    res
      .status(500)
      .json(formatNotification("Failed to save installation ID.", "error"));
  }
};
