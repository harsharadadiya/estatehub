import { Router } from 'express';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { subscribe } from '../services/realtime.js';
import { AppError } from '../utils/AppError.js';
import { signStreamTicket, verifyToken } from '../utils/tokens.js';

const router = Router();

// Step 1: the logged-in browser asks for a 60-second "ticket"
router.post('/ticket', requireAuth, (req, res) => {
  res.json({ ticket: signStreamTicket(currentUser(req).id as string) });
});

// Step 2: it opens new EventSource('/api/realtime/stream?ticket=...')
// (EventSource cannot send an Authorization header, so the short ticket goes in the URL)
router.get('/stream', async (req, res) => {
  const ticket = String(req.query.ticket ?? '');
  if (!ticket) throw new AppError('Missing ticket', 401);
  const payload = verifyToken(ticket, 'stream');
  if (!(await User.exists({ _id: payload.sub }))) throw new AppError('Account not found', 401);
  subscribe(payload.sub, res);
});

export default router;
