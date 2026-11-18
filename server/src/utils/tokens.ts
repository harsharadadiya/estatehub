import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AuthPayload {
  sub: string;
  iat: number;
  exp: number;
  purpose?: 'auth' | 'stream';
  ver?: number;
}

/** Login token (JWT) with the user id and the user's token version */
export function signAuthToken(user: { id: string; tokenVersion?: number }): string {
  return jwt.sign({ purpose: 'auth', ver: user.tokenVersion ?? 0 }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

/** Very short-lived token used only to open the live-updates stream (EventSource cannot send headers) */
export function signStreamTicket(userId: string): string {
  return jwt.sign({ purpose: 'stream' }, env.JWT_SECRET, { subject: userId, expiresIn: 60 });
}

export function verifyToken(token: string, purpose: 'auth' | 'stream'): AuthPayload {
  const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
  if ((payload.purpose ?? 'auth') !== purpose) throw new jwt.JsonWebTokenError('Wrong token type');
  return payload;
}

/** Random token for emails (password reset, guest cancel links). Only the hash is stored. */
export function createRandomToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
