import githubInstall from "../controllers/github/githubInstall.controller";
import githubCallback from "../controllers/github/githubCallback.controller";
import githubRepos from "../controllers/github/githubRepos.controller";
import githubInstallationId from "../controllers/github/githubInstallationID.controller";
import githubSaveInstallationID from "../controllers/github/githubSaveInstallationID.controller";
import { Router } from "express";

const router = Router();

router.get("/install", githubInstall);
router.post("/callback", (req, res) => {
  githubCallback(req, res);
});
router.get("/repos", (req, res) => {
  githubRepos(req, res);
});
router.get("/installation-id", (req, res) => {
  githubInstallationId(req, res);
});
router.post("/installation-id", (req, res) => {
  githubSaveInstallationID(req, res);
});

export default router;
