// Rate limiting: slows down password guessing, spam bookings and abuse of the API.
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const minutes = (n: number) => n * 60 * 1000;
// Generous limits in development so testing is never blocked
const pick = (production: number, development: number) => (env.isProduction ? production : development);

const common = {
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
};

/** All API routes */
export const apiLimiter = rateLimit({
  ...common,
  windowMs: minutes(15),
  limit: pick(600, 5000),
  message: { message: 'Too many requests. Please slow down and try again in a few minutes.' },
});

/** Login, register */
export const authLimiter = rateLimit({
  ...common,
  windowMs: minutes(15),
  limit: pick(20, 500),
  message: { message: 'Too many attempts. Please wait 15 minutes and try again.' },
});

/** Forgot password emails */
export const passwordResetLimiter = rateLimit({
  ...common,
  windowMs: minutes(60),
  limit: pick(5, 200),
  message: { message: 'Too many reset requests. Please try again in an hour.' },
});

/** Guest viewing bookings (no login) */
export const guestBookingLimiter = rateLimit({
  ...common,
  windowMs: minutes(60),
  limit: pick(10, 500),
  message: { message: 'Too many booking requests. Please try again later.' },
});

/** AI Property Hub (costs money per call) */
export const aiLimiter = rateLimit({
  ...common,
  windowMs: minutes(60),
  limit: pick(20, 300),
  message: { message: 'AI search limit reached. Please try again in an hour.' },
});
