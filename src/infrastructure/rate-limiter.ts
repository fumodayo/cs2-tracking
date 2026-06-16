type RateLimitConfig = { windowMs: number; maxRequests: number };

export class RateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private requests: Map<string, number[]>;

  constructor(config: RateLimitConfig) {
    this.windowMs = config.windowMs;
    this.maxRequests = config.maxRequests;
    this.requests = new Map();
  }

  public check(key: string): { allowed: boolean; retryAfter: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing timestamps for this key
    let timestamps = this.requests.get(key) || [];

    // Filter out timestamps outside the sliding window
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= this.maxRequests) {
      // Return retry after time (seconds until the oldest timestamp falls out of the window)
      const oldestTimestamp = timestamps[0];
      const retryAfter = Math.ceil((oldestTimestamp + this.windowMs - now) / 1000);
      return { allowed: false, retryAfter: Math.max(1, retryAfter) };
    }

    // Add current timestamp and save
    timestamps.push(now);
    this.requests.set(key, timestamps);

    return { allowed: true, retryAfter: 0 };
  }
}

// Singleton instances for specific routes/actions
export const geminiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
});

export const steamScanRateLimiter = new RateLimiter({
  windowMs: 2 * 60 * 1000, // 2 minutes
  maxRequests: 5,
});
