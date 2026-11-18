// requireAuth  -> request must carry a valid login token: "Authorization: Bearer <token>"
// optionalAuth -> attaches the user if a valid token is present, otherwise continues as a guest
import type { NextFunction, Request, Response } from 'express';
import { User, type UserDoc } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../utils/tokens.js';

function readBearerToken(req: Request): string | null {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

async function loadUserFromToken(token: string): Promise<UserDoc> {
  const payload = verifyToken(token, 'auth'); // throws for fake or expired tokens
  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user) throw new AppError('This account no longer exists', 401);
  if ((payload.ver ?? 0) !== (user.tokenVersion ?? 0)) {
    throw new AppError('Your password was changed. Please log in again.', 401);
  }
  return user;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearerToken(req);
  if (!token) throw new AppError('Please log in to continue', 401);
  req.user = await loadUserFromToken(token);
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearerToken(req);
  if (token) {
    try {
      req.user = await loadUserFromToken(token);
    } catch {
      // An old or broken token on a public route: just continue as a guest
    }
  }
  next();
}

/** Use after requireAuth: gives the logged-in user with proper typing */
export function currentUser(req: Request): UserDoc {
  if (!req.user) throw new AppError('Please log in to continue', 401);
  return req.user;
}
