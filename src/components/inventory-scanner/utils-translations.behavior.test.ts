import { describe, expect, it } from 'vitest';
import {
  isCookieCredentialError,
  isFamilyViewAccountError,
  isPrivateInventoryAccountError,
  translateAccountError,
  translateImportProgressMessage,
  translateScanProgressMessage,
  translateSyncMessage,
} from './utils-translations';

type TranslationOptions = Record<string, unknown>;

function createTranslator(...translatedKeys: string[]) {
  const keys = new Set(translatedKeys);
  return (key: string, options: TranslationOptions = {}): string =>
    keys.has(key) ? `${key}|${JSON.stringify(options)}` : key;
}

function expectTranslation(
  actual: string,
  key: string,
  expectedOptions: TranslationOptions = {}
): void {
  const separatorIndex = actual.indexOf('|');
  expect(actual.slice(0, separatorIndex)).toBe(key);
  expect(JSON.parse(actual.slice(separatorIndex + 1))).toMatchObject(expectedOptions);
}

describe('translateAccountError structured messages', () => {
  const cases: Array<{
    input: string;
    key: string;
    options: TranslationOptions;
  }> = [
    {
      input: 'duplicateAccountError:name=Primary,steamId=7656',
      key: 'inventoryScanner.apiErrors.duplicateAccountError',
      options: { name: 'Primary', steamId: '7656' },
    },
    {
      input: 'duplicateUrlError:Primary',
      key: 'inventoryScanner.apiErrors.duplicateUrlError',
      options: { name: 'Primary' },
    },
    {
      input: 'cookieSteamIdMismatch:cookieSteamId=1,steamId64=2',
      key: 'inventoryScanner.apiErrors.cookieSteamIdMismatch',
      options: { cookieSteamId: '1', steamId64: '2' },
    },
    {
      input: 'steamConnectionError:status=503',
      key: 'inventoryScanner.apiErrors.steamConnectionError',
      options: { status: '503' },
    },
    {
      input: 'storageUnitFull:name=Main,currentCount=1000,maxCapacity=1000',
      key: 'inventoryScanner.apiErrors.storageUnitFull',
      options: { name: 'Main', currentCount: '1000', maxCapacity: '1000' },
    },
    {
      input:
        'storageUnitCapacityExceeded:name=Main,currentCount=999,addingCount=2,maxCapacity=1000',
      key: 'inventoryScanner.apiErrors.storageUnitCapacityExceeded',
      options: { name: 'Main', currentCount: '999', addingCount: '2', maxCapacity: '1000' },
    },
    {
      input: 'storageUnitItemsAdded:count=2,name=Main',
      key: 'inventoryScanner.apiErrors.storageUnitItemsAdded',
      options: { count: '2', name: 'Main' },
    },
    {
      input: 'processedMissingItemsResult:successCount=2,totalCount=3',
      key: 'inventoryScanner.apiErrors.processedMissingItemsResult',
      options: { successCount: '2', totalCount: '3' },
    },
    {
      input: 'syncedStorageUnitsResult:count=4',
      key: 'inventoryScanner.apiErrors.syncedStorageUnitsResult',
      options: { count: '4' },
    },
    {
      input: 'tooManyRequestsWithRetryAfter:retryAfter=30',
      key: 'inventoryScanner.apiErrors.tooManyRequestsWithRetryAfter',
      options: { retryAfter: '30' },
    },
    {
      input: 'cloudinaryUploadError:message=upload-failed',
      key: 'inventoryScanner.apiErrors.cloudinaryUploadError',
      options: { message: 'upload-failed' },
    },
    {
      input: 'cannotCreateCase:name=Case A',
      key: 'inventoryScanner.apiErrors.cannotCreateCase',
      options: { name: 'Case A' },
    },
    {
      input: 'caseNotFoundWithId:id=case-1',
      key: 'inventoryScanner.apiErrors.caseNotFoundWithId',
      options: { caseId: 'case-1' },
    },
    {
      input: 'geminiPayloadRejectedWithReason:reason=blocked',
      key: 'inventoryScanner.apiErrors.geminiPayloadRejectedWithReason',
      options: { reason: 'blocked' },
    },
    {
      input: 'geminiRecognitionFailedWithReason:reason=unreadable',
      key: 'inventoryScanner.apiErrors.geminiRecognitionFailedWithReason',
      options: { reason: 'unreadable' },
    },
    {
      input: 'cannotFindSteamProfile:vanityName=user,status=404',
      key: 'inventoryScanner.apiErrors.cannotFindSteamProfile',
      options: { vanityName: 'user', status: '404' },
    },
    {
      input: 'cannotFindSteamId64:vanityName=user',
      key: 'inventoryScanner.apiErrors.cannotFindSteamId64',
      options: { vanityName: 'user' },
    },
  ];

  it.each(cases)('maps $input', ({ input, key, options }) => {
    expectTranslation(translateAccountError(input, createTranslator(key)), key, options);
  });

  it('formats Gemini retry information from a structured delay', () => {
    const key = 'inventoryScanner.apiErrors.geminiQuotaExceeded';
    const result = translateAccountError(
      'geminiQuotaExceeded:model=gemini-2,retryDelay=12s',
      createTranslator(key, 'inventoryScanner.apiErrors.retryAfterText')
    );

    expectTranslation(result, key, { model: 'gemini-2' });
    expect(result).toContain('12s');
  });

  it('supports Family View errors and direct backend keys', () => {
    expect(
      translateAccountError(
        'familyViewCookieRequired',
        createTranslator('inventoryScanner.apiErrors.familyViewCookieRequired')
      )
    ).toContain('familyViewCookieRequired');
    expect(
      translateAccountError(
        'steamparental-invalid',
        createTranslator('inventoryScanner.apiErrors.familyViewInvalidParentalCookie')
      )
    ).toContain('familyViewInvalidParentalCookie');
    expect(
      translateAccountError(
        'cookieExpired',
        createTranslator('inventoryScanner.apiErrors.cookieExpired')
      )
    ).toContain('cookieExpired');
  });
});

describe('account error classification', () => {
  it.each(['familyView', 'Family View locked', 'steamparental missing'])(
    'recognizes Family View error %s',
    (error) => expect(isFamilyViewAccountError(error)).toBe(true)
  );

  it.each([
    'cookie expired',
    'session invalid',
    'unauthorized',
    'login required',
    'privateInventory',
  ])('recognizes credential error %s', (error) =>
    expect(isCookieCredentialError(error)).toBe(true)
  );

  it.each([
    'privateInventory',
    'emptyOrPrivateInventory',
    'inventory is private',
    'inventory may be private',
  ])('recognizes private inventory error %s', (error) =>
    expect(isPrivateInventoryAccountError(error)).toBe(true)
  );

  it('rejects empty, malformed and unrelated values', () => {
    expect(isFamilyViewAccountError(null)).toBe(false);
    expect(isCookieCredentialError('familyViewCookieRequired')).toBe(false);
    expect(isPrivateInventoryAccountError('public inventory')).toBe(false);
    expect(isCookieCredentialError('%E0%A4%A')).toBe(false);
  });
});

describe('translateScanProgressMessage', () => {
  const legacyCases = [
    ['\u0110ang ch\u1edd qu\u00e9t', 'inventoryScanner.apiErrors.waitingScan'],
    [
      '\u0110ang \u0111\u1ecbnh d\u1ea1ng link Steam',
      'inventoryScanner.apiErrors.formattingSteamLink',
    ],
    ['Ki\u1ec3m tra cache', 'inventoryScanner.apiErrors.checkingCache'],
    [
      'Ho\u00e0n t\u1ea5t qu\u00e9t (t\u1eeb cache)',
      'inventoryScanner.apiErrors.scanCompleteFromCache',
    ],
    ['Ki\u1ec3m tra c\u1ea5u h\u00ecnh cookie', 'inventoryScanner.apiErrors.checkingCookieConfig'],
    [
      'B\u1eaft \u0111\u1ea7u qu\u00e9t h\u00f2m \u0111\u1ed3 t\u1eeb Steam',
      'inventoryScanner.apiErrors.startingSteamScan',
    ],
    ['\u0110ang ph\u00e2n t\u00edch c\u00e1c item', 'inventoryScanner.apiErrors.analyzingItems'],
    ['\u0110ang l\u1ea5y th\u00f4ng tin gi\u00e1', 'inventoryScanner.apiErrors.fetchingPriceInfo'],
    ['L\u01b0u k\u1ebft qu\u1ea3 qu\u00e9t', 'inventoryScanner.apiErrors.savingScanResult'],
    ['Ho\u00e0n t\u1ea5t qu\u00e9t!', 'inventoryScanner.apiErrors.scanComplete'],
    ['creatingScanJob', 'inventoryScanner.apiErrors.creatingScanJob'],
  ] as const;

  it.each(legacyCases)('maps legacy progress message %s', (message, key) => {
    expect(translateScanProgressMessage(message, createTranslator(key))).toContain(key);
  });

  it('passes structured progress details to i18n', () => {
    const key = 'inventoryScanner.apiErrors.loadingPage';
    const result = translateScanProgressMessage('loadingPage', createTranslator(key), {
      group: 'protected',
      page: 2,
      count: 10,
      name: 'Case',
      max: 100,
      round: 3,
    });

    expectTranslation(result, key, { page: 2, count: 10, name: 'Case', max: 100, round: 3 });
  });

  it('extracts item names from legacy pricing progress', () => {
    const key = 'inventoryScanner.apiErrors.pricingItem';
    const result = translateScanProgressMessage(
      '\u0110ang \u0111\u1ecbnh gi\u00e1: AK-47',
      createTranslator(key)
    );
    expectTranslation(result, key, { name: 'AK-47' });
  });
});

describe('translateSyncMessage', () => {
  const simpleCases = [
    ['syncStartingScan:name=Primary', 'dashboard.syncStartingScan'],
    ['syncDoneScan:name=Primary,count=12', 'dashboard.syncDoneScan'],
    ['syncImportingItems:count=5', 'dashboard.syncImportingItems'],
    ['syncImportedGroupedItems:count=4', 'dashboard.syncImportedGroupedItems'],
  ] as const;

  it.each(simpleCases)('maps structured sync message %s', (message, key) => {
    expect(translateSyncMessage(message, createTranslator(key))).toContain(key);
  });

  it.each([
    'syncComplete:scanned=2,total=2,imported=3,missingCount=1,extraCount=1',
    'syncComplete:scanned=2,total=2,imported=3,missingCount=1,extraCount=0',
    'syncComplete:scanned=2,total=2,imported=3,missingCount=0,extraCount=1',
    'syncComplete:scanned=2,total=2,imported=3,missingCount=0,extraCount=0',
  ])('formats sync completion variant %s', (message) => {
    const result = translateSyncMessage(
      message,
      createTranslator(
        'dashboard.syncSuccessDetail',
        'dashboard.syncDetectedMissingAndExtra',
        'dashboard.syncDetectedMissingOnly',
        'dashboard.syncDetectedExtraOnly'
      )
    );
    expect(result).toContain('dashboard.syncSuccessDetail');
  });

  it.each([
    'syncSingleComplete:name=Primary,missingCount=1,extraCount=1',
    'syncSingleComplete:name=Primary,missingCount=1,extraCount=0',
    'syncSingleComplete:name=Primary,missingCount=0,extraCount=1',
    'syncSingleComplete:name=Primary,missingCount=0,extraCount=0',
  ])('formats single-account completion variant %s', (message) => {
    const result = translateSyncMessage(
      message,
      createTranslator(
        'dashboard.syncSingleCompleteDetail',
        'dashboard.syncDetectedMissingAndExtra',
        'dashboard.syncDetectedMissingOnly',
        'dashboard.syncDetectedExtraOnly'
      )
    );
    expect(result).toContain('dashboard.syncSingleCompleteDetail');
  });

  it('formats minute and second cooldowns', () => {
    const keys = ['dashboard.accountCooldownMessage', 'common.timeMinutesAndSeconds'];
    expect(translateSyncMessage('accountCooldown:seconds=90', createTranslator(...keys))).toContain(
      'dashboard.accountCooldownMessage'
    );
    expect(
      translateSyncMessage(
        'accountCooldown:seconds=10',
        createTranslator('dashboard.accountCooldownMessage', 'common.timeSecondsOnly')
      )
    ).toContain('dashboard.accountCooldownMessage');
  });

  it('uses direct dashboard and API translations before raw fallback', () => {
    expect(translateSyncMessage('syncReady', createTranslator('dashboard.syncReady'))).toContain(
      'dashboard.syncReady'
    );
    expect(
      translateSyncMessage(
        'scanTimeout',
        createTranslator('inventoryScanner.apiErrors.scanTimeout')
      )
    ).toContain('scanTimeout');
    expect(translateSyncMessage('unknown', createTranslator())).toBe('unknown');
  });
});

describe('translateImportProgressMessage', () => {
  const cases = [
    [
      'importProgressProcessingItems:total=10',
      'inventoryScanner.apiErrors.importProgressProcessingItems',
    ],
    [
      'importProgressProcessingItem:current=1,total=10,name=Case',
      'inventoryScanner.apiErrors.importProgressProcessingItem',
    ],
    ['importProgressSavingItems:count=10', 'inventoryScanner.apiErrors.importProgressSavingItems'],
    [
      'importProgressLinkingAccount:current=1,total=2,name=Primary',
      'inventoryScanner.apiErrors.importProgressLinkingAccount',
    ],
    [
      'importErrorCreateCaseFailed:name=Case',
      'inventoryScanner.apiErrors.importErrorCreateCaseFailed',
    ],
    [
      'importErrorRowCaseIdNotFound:row=2',
      'inventoryScanner.apiErrors.importErrorRowCaseIdNotFound',
    ],
    ['importErrorRowCaseNotFound:row=3', 'inventoryScanner.apiErrors.importErrorRowCaseNotFound'],
    [
      'importErrorRowMissingCaseIdOrName:row=4',
      'inventoryScanner.apiErrors.importErrorRowMissingCaseIdOrName',
    ],
    ['importErrorRowInvalidData:row=5', 'inventoryScanner.apiErrors.importErrorRowInvalidData'],
    [
      'importErrorRowInvalidQuantity:row=6',
      'inventoryScanner.apiErrors.importErrorRowInvalidQuantity',
    ],
    ['importErrorRowInvalidPrice:row=7', 'inventoryScanner.apiErrors.importErrorRowInvalidPrice'],
    ['importErrorRowInvalidDate:row=8', 'inventoryScanner.apiErrors.importErrorRowInvalidDate'],
  ] as const;

  it.each(cases)('maps import message %s', (message, key) => {
    expect(translateImportProgressMessage(message, createTranslator(key))).toContain(key);
  });

  it('distinguishes imports with and without skipped rows', () => {
    expect(
      translateImportProgressMessage(
        'importDoneSaveResult:count=8,skipped=2',
        createTranslator('inventoryScanner.apiErrors.importDoneSaveResultWithSkipped')
      )
    ).toContain('importDoneSaveResultWithSkipped');
    expect(
      translateImportProgressMessage(
        'importDoneSaveResult:count=8,skipped=0',
        createTranslator('inventoryScanner.apiErrors.importDoneSaveResult')
      )
    ).toContain('importDoneSaveResult');
  });

  it('uses direct translations and preserves unknown messages', () => {
    expect(
      translateImportProgressMessage(
        'importReady',
        createTranslator('inventoryScanner.apiErrors.importReady')
      )
    ).toContain('importReady');
    expect(translateImportProgressMessage('unknown', createTranslator())).toBe('unknown');
    expect(translateImportProgressMessage(null, createTranslator())).toBe('');
  });
});
