import { Request, Response } from 'express';
import crypto from 'crypto';
import env from '../../config/env';
import User from '../../models/user.model';
import { sendVerificationEmail } from '../../utils/auth/verification';
import log, { formatNotification } from '../../utils/logging/logger';

const resendVerification = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    log({ type: 'error', message: 'Please provide your email address.' });
    return res.status(400).json(formatNotification('Please provide your email address.', 'error'));
  }

  const user = await User.findOne({ email });

  if (!user) {
    log({
      type: 'error',
      message: 'No account found with this email address.',
    });
    return res
      .status(400)
      .json(formatNotification('No account found with this email address.', 'error'));
  }

  if (user.isVerified) {
    log({ type: 'warning', message: 'This email is already verified.' });
    return res
      .status(400)
      .json(formatNotification('This email is already verified. Please log in.', 'warning'));
  }

  const token = crypto.randomBytes(32).toString('hex');
  user.verificationToken = token;
  await user.save();

  if (!env.CUSTOM_DOMAIN) {
    log({
      type: 'error',
      message: 'CUSTOM_DOMAIN is not set in environment variables.',
    });
    return res
      .status(500)
      .json(formatNotification('Server configuration error. Please contact support.', 'error'));
  }

  await sendVerificationEmail({
    to: user.email,
    token,
    domain: env.CUSTOM_DOMAIN,
    name: user.name,
  });

  res.json({
    message: 'Verification email resent! Please check your inbox.',
  });
};

export default resendVerification;
