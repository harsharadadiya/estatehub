// AI Property Hub routes. All of them answer 404 when the feature flag is off,
// so the rest of the platform works exactly the same without the AI module.
import { Router, type NextFunction, type Request, type Response } from 'express';
import { env } from '../config/env.js';
import { aiLimiter } from '../middleware/rateLimiters.js';
import { validateBody } from '../middleware/validate.js';
import { isAiHubAvailable, runAiSearch } from '../services/ai/aiHub.js';
import { isClaudeConfigured } from '../services/ai/claudeRanker.js';
import { AppError } from '../utils/AppError.js';
import { aiSearchSchema, type AiSearchInput } from '../validators/schemas.js';

const router = Router();

function requireFeature(_req: Request, _res: Response, next: NextFunction) {
  if (!isAiHubAvailable()) throw new AppError('The AI Property Hub is turned off (AI_HUB_ENABLED=false)', 404);
  next();
}

router.get('/status', requireFeature, (_req, res) => {
  res.json({ enabled: true, aiRanking: isClaudeConfigured(), serverFirecrawlKey: Boolean(env.FIRECRAWL_API_KEY) });
});

router.post('/search', requireFeature, aiLimiter, validateBody(aiSearchSchema), async (req, res) => {
  // "Bring your own key": the user's Firecrawl key arrives in a header and is never stored or logged
  const userKey = String(req.headers['x-firecrawl-key'] ?? '').trim();
  if (userKey && !/^fc-[A-Za-z0-9_-]{8,}$/.test(userKey)) throw new AppError('That does not look like a Firecrawl key (it should start with "fc-")', 400);

  // Development only: "x-simulate-rate-limit: 2" pretends the first 2 Firecrawl calls hit a rate limit
  const simulate = env.isProduction ? 0 : Math.min(3, Number(req.headers['x-simulate-rate-limit']) || 0);

  const data = await runAiSearch(req.body as AiSearchInput, {
    firecrawlKey: userKey || env.FIRECRAWL_API_KEY,
    simulateRateLimits: simulate,
  });
  res.json(data);
});

export default router;
