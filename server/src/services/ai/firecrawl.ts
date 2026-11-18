// Firecrawl client: "search to scrape".
//  1) search() finds listing URLs on property portals
//  2) scrape() downloads each listing page as clean markdown
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { HttpError, parseRetryAfter, withRetry, type RetryStats } from './retry.js';

export interface SearchHit {
  url: string;
  title: string;
  description: string;
}

export interface ScrapedPage {
  url: string;
  title: string;
  markdown: string;
  image: string | null;
}

interface ClientOptions {
  apiKey: string;
  stats: RetryStats;
  /** Development only: pretend the first N calls were rate-limited, to watch the retry logic work */
  simulateRateLimits?: number;
}

export function createFirecrawlClient({ apiKey, stats, simulateRateLimits = 0 }: ClientOptions) {
  let simulatedLeft = simulateRateLimits;

  async function call<T>(path: string, body: unknown): Promise<T> {
    if (simulatedLeft > 0) {
      simulatedLeft -= 1;
      throw new HttpError('Simulated rate limit (development test)', 429, 600);
    }

    const response = await fetch(`${env.FIRECRAWL_API_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });

    if (response.ok) return (await response.json()) as T;

    const detail = ((await response.json().catch(() => ({}))) as { error?: string }).error ?? response.statusText;
    if (response.status === 401 || response.status === 403) {
      throw new AppError('Firecrawl rejected the API key. Check the key in AI Hub settings.', 400, { code: 'FIRECRAWL_KEY' });
    }
    if (response.status === 402) throw new AppError('Your Firecrawl credits are used up. Add credits or use another key.', 402, { code: 'FIRECRAWL_CREDITS' });
    throw new HttpError(`Firecrawl ${path} failed: ${detail}`, response.status, parseRetryAfter(response.headers.get('retry-after')));
  }

  /** Turns "still failing after all retries" into a friendly message */
  async function retried<T>(label: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await withRetry(fn, { label, stats });
    } catch (error) {
      if (error instanceof HttpError && error.status === 429) {
        throw new AppError('Firecrawl is rate limiting requests. Please wait a minute and try again.', 503, { code: 'RATE_LIMITED' });
      }
      throw error;
    }
  }

  return {
    async search(query: string, options: { limit: number; includeDomains: string[]; location?: string }): Promise<SearchHit[]> {
      const data = await retried('Firecrawl search', () =>
        call<{ data?: { web?: Array<{ url?: string; title?: string; description?: string }> } }>('/v2/search', {
          query,
          limit: options.limit,
          includeDomains: options.includeDomains,
          country: 'IN',
          ...(options.location && { location: options.location }),
          timeout: 40_000,
        })
      );
      return (data.data?.web ?? [])
        .filter((hit): hit is { url: string; title?: string; description?: string } => Boolean(hit.url))
        .map((hit) => ({ url: hit.url, title: hit.title ?? '', description: hit.description ?? '' }));
    },

    async scrape(url: string): Promise<ScrapedPage> {
      const data = await retried(`Firecrawl scrape ${new URL(url).hostname}`, () =>
        call<{ data?: { markdown?: string; metadata?: { title?: string; ogImage?: string; 'og:image'?: string } } }>('/v2/scrape', {
          url,
          formats: ['markdown'],
          onlyMainContent: true,
          maxAge: 2 * 24 * 60 * 60 * 1000, // reuse Firecrawl's cached copy if it is less than 2 days old (faster, cheaper)
          timeout: 40_000,
        })
      );
      const meta = data.data?.metadata ?? {};
      return {
        url,
        title: meta.title ?? '',
        markdown: data.data?.markdown ?? '',
        image: meta.ogImage ?? meta['og:image'] ?? null,
      };
    },
  };
}
