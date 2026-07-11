import { fetchWithTimeout } from '@/utils/fetch-with-timeout';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 2_000;
const DEFAULT_MAX_DELAY_MS = 15_000;

type RateLimitRetry = {
  nextAttempt: number;
  maxAttempts: number;
  delayMs: number;
};

type SteamFetchRetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRateLimitRetry?: (retry: RateLimitRetry) => void;
};

export async function fetchSteamWithRateLimitRetry(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
  options: SteamFetchRetryOptions = {}
): Promise<Response> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS);
  const maxDelayMs = Math.max(0, options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetchWithTimeout(input, init, timeoutMs);
    if (response.status !== 429 || attempt === maxAttempts) {
      return response;
    }

    const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
    const exponentialDelayMs = baseDelayMs * 2 ** (attempt - 1);
    const delayMs = Math.min(retryAfterMs ?? exponentialDelayMs, maxDelayMs);

    options.onRateLimitRetry?.({
      nextAttempt: attempt + 1,
      maxAttempts,
      delayMs,
    });
    await wait(delayMs);
  }

  throw new Error('steamRateLimited');
}

export function parseRetryAfterMs(value: string | null, nowMs = Date.now()): number | null {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000;
  }

  const retryAtMs = Date.parse(value);
  return Number.isNaN(retryAtMs) ? null : Math.max(0, retryAtMs - nowMs);
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
