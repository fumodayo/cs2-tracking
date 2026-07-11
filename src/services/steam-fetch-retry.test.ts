import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSteamWithRateLimitRetry, parseRetryAfterMs } from './steam-fetch-retry';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchSteamWithRateLimitRetry', () => {
  it('retries HTTP 429 and returns the next successful response', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response('{"success":1}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const onRateLimitRetry = vi.fn();
    const response = await fetchSteamWithRateLimitRetry(
      'https://steamcommunity.com/inventory/test',
      undefined,
      1_000,
      { baseDelayMs: 0, onRateLimitRetry }
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRateLimitRetry).toHaveBeenCalledWith({
      nextAttempt: 2,
      maxAttempts: 3,
      delayMs: 0,
    });
  });

  it('returns the last 429 response after exhausting retries', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchSteamWithRateLimitRetry(
      'https://steamcommunity.com/inventory/test',
      undefined,
      1_000,
      { baseDelayMs: 0, maxAttempts: 3 }
    );

    expect(response.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('parseRetryAfterMs', () => {
  it('supports delay seconds and HTTP dates', () => {
    expect(parseRetryAfterMs('5')).toBe(5_000);
    expect(parseRetryAfterMs('Thu, 01 Jan 2026 00:00:05 GMT', Date.UTC(2026, 0, 1))).toBe(5_000);
  });

  it('ignores invalid values', () => {
    expect(parseRetryAfterMs(null)).toBeNull();
    expect(parseRetryAfterMs('later')).toBeNull();
  });
});
