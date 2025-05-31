import axios from "axios";
import jwt from "jsonwebtoken";
import { GITHUB_APP_ID, GITHUB_PRIVATE_KEY } from "../config";

const privateKey = GITHUB_PRIVATE_KEY?.replace(/\\n/g, "\n");

export const generateGitHubToken = async (installationId: string) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 540,
    iss: GITHUB_APP_ID,
  };
  const token = jwt.sign(payload, privateKey!, { algorithm: "RS256" });

  const response = await axios.post(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  return response.data.token;
};
