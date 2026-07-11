import { describe, expect, it } from 'vitest';
import { buildFailedLiveScanFallbackScopes } from './scan-cache-fallback';

describe('buildFailedLiveScanFallbackScopes', () => {
  it('tries public cache first and same-owner private cache second when the request has no cookie', () => {
    expect(
      buildFailedLiveScanFallbackScopes({
        steamId64: '76561198000000000',
        ownerId: 'google:user-1',
        requestHasCookie: false,
      })
    ).toEqual([
      {
        scope: {
          steamId64: '76561198000000000',
          ownerId: 'google:user-1',
          hasCookie: false,
        },
        includePrivateFields: false,
      },
      {
        scope: {
          steamId64: '76561198000000000',
          ownerId: 'google:user-1',
          hasCookie: true,
        },
        includePrivateFields: false,
      },
    ]);
  });

  it('does not expose private fields when the request has no cookie', () => {
    const scopes = buildFailedLiveScanFallbackScopes({
      steamId64: '76561198000000000',
      ownerId: 'google:user-1',
      requestHasCookie: false,
    });

    expect(scopes.every((scope) => scope.includePrivateFields === false)).toBe(true);
  });

  it('uses only private cache when the request has a cookie', () => {
    expect(
      buildFailedLiveScanFallbackScopes({
        steamId64: '76561198000000000',
        ownerId: 'google:user-1',
        requestHasCookie: true,
      })
    ).toEqual([
      {
        scope: {
          steamId64: '76561198000000000',
          ownerId: 'google:user-1',
          hasCookie: true,
        },
        includePrivateFields: true,
      },
    ]);
  });

  it('does not try private cache for guest owners', () => {
    expect(
      buildFailedLiveScanFallbackScopes({
        steamId64: '76561198000000000',
        ownerId: 'guest',
        requestHasCookie: false,
      })
    ).toHaveLength(1);
  });
});
