import { Request, Response } from "express";
import axios from "axios";
import { log, formatNotification } from "../../utils/logging/logger";
import getUserFromSession from "../../utils/github/getUserFromSession";
import createGitHubJwt from "../../utils/github/createGithubJWT";

const githubRepos = async (req: Request, res: Response) => {
  try {
    let installationIds: string[] = [];
    let user = null;
    let userChanged = false;

    // Always get user from session if possible
    user = await getUserFromSession(req);

    if (req.query.installation_ids) {
      installationIds = (req.query.installation_ids as string).split(",");
      // If user exists, filter their githubInstallationId to only keep valid ones
      if (
        user &&
        user.githubInstallationId &&
        Array.isArray(user.githubInstallationId)
      ) {
        const validIds = new Set(installationIds);
        const before = user.githubInstallationId.length;
        user.githubInstallationId = user.githubInstallationId.filter(
          (id: string) => validIds.has(id)
        );
        if (user.githubInstallationId.length !== before) {
          userChanged = true;
        }
      }
    } else if (user) {
      if (
        !user.githubInstallationId ||
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
        // If 404, 401, or 403, remove the installationId from user and DB
        if (error.response && [404, 401, 403].includes(error.response.status)) {
          // Remove from current request's installationIds
          installationIds = installationIds.filter(
            (id: string) => id !== installationId
          );
          // Remove from user DB if user exists
          if (user && user.githubInstallationId?.includes(installationId)) {
            user.githubInstallationId = user.githubInstallationId.filter(
              (id: string) => id !== installationId
            );
            userChanged = true;
          }
          removedInstallationIds.push(installationId);
          // Continue to next installationId instead of throwing
          continue;
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

export default githubRepos;
