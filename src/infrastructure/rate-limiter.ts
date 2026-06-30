import { getDatabase } from '@/infrastructure/db/mongo-client';
import crypto from 'node:crypto';

type RateLimitConfig = { windowMs: number; maxRequests: number };

export class RateLimiter {
  private name: string;
  private windowMs: number;
  private maxRequests: number;

  constructor(name: string, config: RateLimitConfig) {
    this.name = name;
    this.windowMs = config.windowMs;
    this.maxRequests = config.maxRequests;
  }

  public async check(ip: string): Promise<{ allowed: boolean; retryAfter: number }> {
    const key = `${this.name}:${ip}`;
    const attemptId = crypto.randomUUID();
    const now = Date.now();
    const windowStart = now - this.windowMs;

    try {
      const db = await getDatabase();
      const collection = db.collection('rate_limits');

      const doc = (await collection.findOneAndUpdate(
        { key },
        [
          {
            $set: {
              timestamps: {
                $filter: {
                  input: { $ifNull: ['$timestamps', []] },
                  as: 'timestamp',
                  cond: { $gt: ['$$timestamp', windowStart] },
                },
              },
            },
          },
          {
            $set: {
              timestamps: {
                $cond: [
                  { $lt: [{ $size: '$timestamps' }, this.maxRequests] },
                  { $concatArrays: ['$timestamps', [now]] },
                  '$timestamps',
                ],
              },
              lastAcceptedAttemptId: {
                $cond: [
                  { $lt: [{ $size: '$timestamps' }, this.maxRequests] },
                  attemptId,
                  '$lastAcceptedAttemptId',
                ],
              },
              updatedAt: new Date(),
            },
          },
        ],
        {
          upsert: true,
          returnDocument: 'after',
        }
      )) as { timestamps?: number[]; lastAcceptedAttemptId?: string } | null;

      const timestamps = Array.isArray(doc?.timestamps) ? doc.timestamps : [];
      if (doc?.lastAcceptedAttemptId !== attemptId) {
        const oldestTimestamp = timestamps[0];
        const retryAfter = oldestTimestamp
          ? Math.ceil((oldestTimestamp + this.windowMs - now) / 1000)
          : Math.ceil(this.windowMs / 1000);
        return { allowed: false, retryAfter: Math.max(1, retryAfter) };
      }

      return { allowed: true, retryAfter: 0 };
    } catch (err) {
      console.error(`[RateLimiter] Error checking rate limit for ${key}:`, err);
      if (process.env.NODE_ENV === 'production') {
        return { allowed: false, retryAfter: Math.ceil(this.windowMs / 1000) };
      }
      return { allowed: true, retryAfter: 0 };
    }
  }
}

// Singleton instances for specific routes/actions
export const geminiRateLimiter = new RateLimiter('gemini', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
});

export const steamScanRateLimiter = new RateLimiter('steam-scan', {
  // windowMs: 2 * 60 * 1000, // 2 minutes
  windowMs: 1000,
  maxRequests: 15,
});

export const cs2capValidationRateLimiter = new RateLimiter('cs2cap-val', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
});

export const pricesRefreshRateLimiter = new RateLimiter('prices-refresh', {
  windowMs: 2 * 60 * 1000, // 2 minutes
  maxRequests: 5,
});

export const bugReportRateLimiter = new RateLimiter('bug-report', {
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 3,
});

export const retryPriceRateLimiter = new RateLimiter('retry-price', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
});

export const buffPriceRateLimiter = new RateLimiter('buff-price', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 15,
});
