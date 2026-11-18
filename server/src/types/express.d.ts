import type { UserDoc } from '../models/User.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth / optionalAuth */
      user?: UserDoc;
      /** Cleaned query string after validation (Express 5 does not allow replacing req.query) */
      validatedQuery?: unknown;
    }
  }
}

export {};
