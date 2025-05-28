import { Router, Request, Response } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";

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

router.get("/install", (req, res) => {
  const installUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`;
  return res.redirect(installUrl);
});

router.get("/callback", (req: any, res: any) => {
  return res.send(
    "GitHub App installed successfully! You can close this window."
  );
});

router.get("/repos", function (req, res) {
  (async () => {
    try {
      const installationId = req.query.installation_id as string;
      if (!installationId) {
        return res
          .status(400)
          .json({ error: "Missing installation_id query parameter" });
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
      if (!accessToken) {
        return res
          .status(500)
          .json({ error: "Failed to obtain installation access token" });
      }

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
    } catch (error: any) {
      console.error(
        "GitHub /repos error:",
        error.response?.data || error.message || error
      );
      return res.status(500).json({
        error:
          error.response?.data?.message ||
          error.message ||
          "Internal Server Error",
      });
    }
  })();
});

export default router;
