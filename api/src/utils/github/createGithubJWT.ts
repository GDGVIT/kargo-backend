import jwt from "jsonwebtoken";
import env from "../../config/env";

function createGitHubJWT() {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iat: now - 60,
      exp: now + 540,
      iss: env.GITHUB_APP_ID,
    },
    env.GITHUB_PRIVATE_KEY,
    { algorithm: "RS256" }
  );
}

export default createGitHubJWT;
