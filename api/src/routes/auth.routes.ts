// Authentication routes for user registration, login, OAuth, and profile management
import { Router } from 'express';
import asyncHandler from '../utils/handlers/asyncHandler';
import ensureAuthenticated from '../utils/auth/ensureAuthenticated';

import register from '../controllers/auth/register.controller';
import login from '../controllers/auth/login.controller';
import logout from '../controllers/auth/logout.controller';
import googleAuth from '../controllers/auth/googleAuth.controller';
import googleCallback from '../controllers/auth/googleCallback.controller';
import githubAuth from '../controllers/auth/githubAuth.controller';
import githubCallback from '../controllers/auth/githubCallback.controller';
import getMe from '../controllers/auth/getMe.controller';
import setUsername from '../controllers/auth/setUsername.controller';
import verifyEmail from '../controllers/auth/verifyEmail.controller';
import resendVerification from '../controllers/auth/resendVerification.controller';

const router = Router();

// Register a new user
router.post('/register', asyncHandler(register));
// Login user
router.post('/login', asyncHandler(login));
// Logout user
router.post('/logout', logout);
// Google OAuth authentication
router.get('/google', googleAuth);
// Google OAuth callback
router.get('/google/callback', googleCallback);
// GitHub OAuth authentication
router.get('/github', githubAuth);
// GitHub OAuth callback
router.get('/github/callback', githubCallback);
// Get current user profile (requires authentication)
router.get('/me', ensureAuthenticated, asyncHandler(getMe));
// Set or update username
router.post('/set-username', asyncHandler(setUsername));
// Verify email address
router.get('/verify-email', asyncHandler(verifyEmail));
// Resend verification email
router.post('/resend-verification', asyncHandler(resendVerification));

export default router;
