import type { ScanCacheScope } from '@/services/scan-cache';

export type FailedLiveScanFallbackScope = {
  scope: ScanCacheScope;
  includePrivateFields: boolean;
};

export function buildFailedLiveScanFallbackScopes(input: {
  steamId64: string;
  ownerId?: string;
  requestHasCookie: boolean;
}): FailedLiveScanFallbackScope[] {
  const { steamId64, ownerId, requestHasCookie } = input;
  const scopes: FailedLiveScanFallbackScope[] = [
    {
      scope: { steamId64, ownerId, hasCookie: requestHasCookie },
      includePrivateFields: requestHasCookie,
    },
  ];

  if (!requestHasCookie && ownerId && ownerId !== 'guest') {
    scopes.push({
      scope: { steamId64, ownerId, hasCookie: true },
      includePrivateFields: false,
    });
  }

  return scopes;
}
