import { Request, Response } from "express";
import env from "../../config/env";

const githubInstall = (_req: Request, res: Response) => {
  const GITHUB_APP_SLUG = env.GITHUB_APP_SLUG;
  res.redirect(`https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`);
};

export default githubInstall;
