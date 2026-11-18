import type { Request, Response } from 'express';
import type { z } from 'zod';
import { env } from '../config/env.js';
import { Appointment } from '../models/Appointment.js';
import { User } from '../models/User.js';
import { sendEmail } from '../services/email.js';
import { AppError } from '../utils/AppError.js';
import { createRandomToken, hashToken, signAuthToken } from '../utils/tokens.js';
import type { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '../validators/schemas.js';

const RESET_TOKEN_MINUTES = 30;

// POST /api/auth/register
export async function register(req: Request, res: Response) {
  const { name, email, password, phone } = req.body as z.infer<typeof registerSchema>;

  if (await User.exists({ email })) throw new AppError('An account with this email already exists', 409);

  const user = await User.create({ name, email, password, phone });

  // Viewings booked earlier as a guest with this email now appear in the new account's dashboard
  await Appointment.updateMany({ email, user: null }, { $set: { user: user._id } });

  res.status(201).json({ token: signAuthToken(user), user });
}

// POST /api/auth/login
export async function login(req: Request, res: Response) {
  const { email, password } = req.body as z.infer<typeof loginSchema>;

  const user = await User.findOne({ email }).select('+password +tokenVersion');
  // Same message for "unknown email" and "wrong password", so attackers cannot discover accounts
  if (!user || !(await user.comparePassword(password))) throw new AppError('Invalid email or password', 401);

  res.json({ token: signAuthToken(user), user });
}

// POST /api/auth/forgot-password
export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body as z.infer<typeof forgotPasswordSchema>;
  const genericMessage = 'If an account exists for this email, a password reset link has been sent. It is valid for 30 minutes.';

  const user = await User.findOne({ email });
  if (!user) {
    res.json({ message: genericMessage });
    return;
  }

  const { token, hash } = createRandomToken();
  user.passwordResetTokenHash = hash;
  user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${env.SITE_URL}/reset-password?token=${token}`;
  const sent = await sendEmail({
    to: user.email,
    subject: 'Reset your EstateHub password',
    heading: `Hi ${user.name.split(' ')[0]}, reset your password`,
    paragraphs: [
      'We received a request to reset the password for your EstateHub account.',
      `Click the button below to choose a new password. The link works for ${RESET_TOKEN_MINUTES} minutes and can be used once.`,
      'If you did not ask for this, you can safely ignore this email. Your password will not change.',
    ],
    button: { label: 'Reset password', url: resetUrl },
  });

  res.json({
    message: genericMessage,
    // Development only (no SMTP configured): return the link so you can test without an email account
    ...(!env.isProduction && !sent && { devResetUrl: resetUrl }),
  });
}

// POST /api/auth/reset-password
export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.body as z.infer<typeof resetPasswordSchema>;

  const user = await User.findOne({
    passwordResetTokenHash: hashToken(token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpires +tokenVersion');

  if (!user) throw new AppError('This reset link is invalid or has expired. Please request a new one.', 400);

  user.password = password; // hashed by the pre-save hook; old login tokens stop working
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  void sendEmail({
    to: user.email,
    subject: 'Your EstateHub password was changed',
    heading: 'Your password was changed',
    paragraphs: [
      'The password for your EstateHub account was just changed.',
      'If this was not you, reset your password immediately using "Forgot password" on the login page.',
    ],
  });

  res.json({ message: 'Password updated. You are now logged in.', token: signAuthToken(user), user });
}
