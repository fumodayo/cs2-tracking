import { describe, expect, it } from 'vitest';
import { SCAN_CACHE_STALE_RETENTION_SECONDS } from './scan-cache-policy';

describe('scan cache policy', () => {
  it('keeps stale cache for one day after its freshness expiry', () => {
    expect(SCAN_CACHE_STALE_RETENTION_SECONDS).toBe(24 * 60 * 60);
  });
});
