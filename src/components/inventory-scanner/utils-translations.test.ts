import { describe, expect, it } from 'vitest';
import { translateAccountError, translateSyncMessage } from './utils-translations';

type TranslationOptions = Record<string, unknown>;

const translations: Record<string, string> = {
  'dashboard.syncErrorScan': 'Scan error for {{name}}: {{error}}',
  'dashboard.syncFailedSkippedAccountsPreserved':
    'Sync failed because one account could not be scanned.',
  'inventoryScanner.apiErrors.cannotReadScanProgress': 'Cannot read progress',
  'inventoryScanner.apiErrors.scanTimeout': 'Scan timed out',
  'inventoryScanner.apiErrors.steamHttpError': 'Steam HTTP {{status}}',
  'inventoryScanner.apiErrors.steamRateLimited': 'Steam server rate limited',
  'inventoryScanner.apiErrors.tooManyRequests': 'Too many requests',
};

function t(key: string, options: TranslationOptions = {}): string {
  const template = translations[key];
  if (!template) return key;

  return template.replace(/\{\{(\w+)\}\}/g, (_, optionKey: string) =>
    String(options[optionKey] ?? '')
  );
}

describe('inventory scanner translations', () => {
  it('keeps structured values that contain equals signs', () => {
    expect(
      translateSyncMessage('syncErrorScan:name=fumodayo,error=steamHttpError:status=429', t)
    ).toBe('Scan error for fumodayo: Steam HTTP 429');
  });

  it('keeps commas inside structured values', () => {
    expect(
      translateSyncMessage(
        'syncErrorScan:name=fumo,dayo,error=steamHttpError:status=429,message=ignored',
        t
      )
    ).toBe('Scan error for fumo,dayo: Steam HTTP 429');
  });

  it('translates steam HTTP errors directly', () => {
    expect(translateAccountError('steamHttpError:status=500', t)).toBe('Steam HTTP 500');
    expect(translateAccountError('steamRateLimited', t)).toBe('Steam server rate limited');
  });

  it('falls back to raw backend messages instead of exposing missing i18n keys', () => {
    expect(translateAccountError('missingBackendKey', t)).toBe('missingBackendKey');
  });

  it('translates the skipped account preservation error', () => {
    expect(translateSyncMessage('syncFailedSkippedAccountsPreserved', t)).toBe(
      'Sync failed because one account could not be scanned.'
    );
  });

  it('translates backend scan error keys that can surface through sync', () => {
    expect(translateAccountError('scanTimeout', t)).toBe('Scan timed out');
    expect(translateSyncMessage('cannotReadScanProgress', t)).toBe('Cannot read progress');
    expect(translateAccountError('tooManyRequests', t)).toBe('Too many requests');
  });
});
