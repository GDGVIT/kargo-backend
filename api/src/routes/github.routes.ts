// GitHub integration routes for Github App, installation, and repository management
import { Router } from 'express';

import githubInstall from '../controllers/github/githubInstall.controller';
import githubCallback from '../controllers/github/githubCallback.controller';
import githubRepos from '../controllers/github/githubRepos.controller';
import githubInstallationId from '../controllers/github/githubInstallationID.controller';
import githubSaveInstallationID from '../controllers/github/githubSaveInstallationID.controller';

const router = Router();

// Start GitHub App installation flow
router.get('/install', githubInstall);

// GitHub OAuth callback
router.post('/callback', (req, res) => {
  githubCallback(req, res);
});

// Get user's GitHub repositories
router.get('/repos', (req, res) => {
  githubRepos(req, res);
});

// Get GitHub installation ID for the user
router.get('/installation-id', (req, res) => {
  githubInstallationId(req, res);
});

// Save GitHub installation ID for the user
router.post('/installation-id', (req, res) => {
  githubSaveInstallationID(req, res);
});

export default router;
