// Retry with exponential backoff – used for every external API call in the AI Property Hub.
// Retries on 429 (rate limit), 5xx (server errors), timeouts and network failures.
// Honors the "Retry-After" header when the API sends one.

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface RetryStats {
  retries: number;
  log: string[];
}

interface RetryOptions {
  label: string;
  stats: RetryStats;
  retries?: number; // extra attempts after the first one
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function isRetryable(error: unknown): boolean {
  if (error instanceof HttpError) return error.status === 408 || error.status === 429 || error.status >= 500;
  const name = (error as { name?: string })?.name;
  // TimeoutError/AbortError = request took too long; TypeError = network failure in fetch()
  return name === 'TimeoutError' || name === 'AbortError' || name === 'TypeError';
}

/** Reads "Retry-After" (seconds or a date) into milliseconds */
export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

export async function withRetry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  const { label, stats, retries = 3, baseDelayMs = 800, maxDelayMs = 8000 } = options;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (attempt >= retries || !isRetryable(error)) throw error;

      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const jitter = Math.random() * 250; // spreads retries out so they do not all hit at once
      const serverHint = error instanceof HttpError ? error.retryAfterMs : undefined;
      const delay = Math.min(maxDelayMs, serverHint ?? backoff) + jitter;

      stats.retries += 1;
      const reason = error instanceof HttpError ? `HTTP ${error.status}` : (error as Error).name;
      stats.log.push(`${label}: ${reason} – retry ${attempt + 1}/${retries} in ${Math.round(delay)} ms`);
      console.warn(`🔁 ${stats.log.at(-1)}`);
      await sleep(delay);
    }
  }
}
