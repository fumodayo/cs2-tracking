import { AccountEntry, InventoryItemType, ScanResponse, SourceAccount } from './types';

export const LS_RATE_ALL = 'cs2t_rateAll';
export const LS_RATE_LE = 'cs2t_rateLe';
export const LS_ACCOUNTS = 'cs2t_accounts';
export const LS_MANUAL_ITEMS = 'cs2t_manualItems';
export const LS_BUFF_CNY_TO_VND_RATE = 'cs2t_buffCnyToVndRate';
export const LS_BUFF_PRICES_CNY = 'cs2t_buffPricesCny';
export const DEFAULT_BUFF_CNY_TO_VND_RATE = 3600;
export const SCAN_REQUEST_TIMEOUT_MS = 20 * 60_000;
export const SCAN_PROGRESS_IDLE_TIMEOUT_MS = 8 * 60_000;

/**
 * Reads a number rate from localStorage, with fallback protection.
 */
export function readRate(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const v = localStorage.getItem(key);
  return v ? Number(v) || fallback : fallback;
}

let nextId = 1;

/**
 * Instantiates a new empty account entry layout.
 */
export function createAccount(url: string): AccountEntry {
  return {
    id: `acc_${Date.now()}_${nextId++}`,
    url,
    steamCookie: '',
    steamSessionId: '',
    status: 'idle',
    result: null,
    error: null,
    progress: null,
  };
}

/**
 * Normalizes a Steam URL or vanity input for duplicate comparisons.
 * Converts to lowercase and removes trailing slashes.
 */
export function normalizeSteamInput(raw: string): string {
  return raw.trim().replace(/\/+$/, '').toLowerCase();
}

/**
 * Extracts a comparable unique key from a Steam URL.
 * Handles /profiles/[id], /id/[vanity], or a raw SteamID64 input.
 */
export function extractSteamKey(raw: string): string | null {
  const s = normalizeSteamInput(raw);
  if (!s) return null;

  const profileMatch = s.match(/\/profiles\/(\d{17})/);
  if (profileMatch) return profileMatch[1];

  const idMatch = s.match(/\/id\/([^/]+)/);
  if (idMatch) return `vanity:${idMatch[1]}`;

  if (/^\d{17}$/.test(s)) return s;

  if (!s.includes('/')) return `vanity:${s}`;
  return s;
}

import { formatVND } from '@/utils/format';
export { formatVND };

/**
 * Formats a raw number with local grouping separators.
 */
export function formatPlainNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

/**
 * Formats multi-page scanning progress descriptions.
 */
export function formatProgressDetail(
  detail: Record<string, number | string>,
  t: (key: string, options?: any) => string
): string {
  const parts: string[] = [];
  if (detail.page) parts.push(`page ${detail.page}`);
  if (detail.assets)
    parts.push(t('inventoryScanner.apiErrors.itemsRead', { count: Number(detail.assets) }));
  if (detail.priced && detail.total)
    parts.push(
      t('inventoryScanner.apiErrors.itemsPriced', { priced: detail.priced, total: detail.total })
    );
  return parts.join(' · ');
}

/**
 * Derives an InventoryItemType enum value based on name conventions.
 */
export function getInventoryItemType(name: string): InventoryItemType {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('capsule') || nameLower.includes('package')) return 'Capsule';
  if (nameLower.startsWith('sticker |')) return 'Sticker';
  if (nameLower.includes(' | ')) return 'Skin';
  return 'Case';
}

/**
 * Maps which profiles contributed to a given marketHashName item.
 */
export function getSourceAccountsForItem(
  results: ScanResponse[],
  marketHashName: string
): SourceAccount[] {
  return results
    .filter((result) =>
      result.items.some((item) => item.caseItem.marketHashName === marketHashName)
    )
    .map((result) => ({
      steamId64: result.steamId64,
      name: result.profile?.name || result.steamId64,
    }));
}

export function getSteamMarketListingUrl(marketHashName: string): string {
  return `https://steamcommunity.com/market/listings/730/${encodeURIComponent(marketHashName)}`;
}

export function getItemTypeColor(type: string): string {
  switch (type) {
    case 'Skin':
      return '#b0c3d9'; // Consumer grade fallback
    case 'Sticker':
      return '#4b69ff';
    case 'Capsule':
    case 'Case':
    default:
      return '#b0c3d9'; // ALWAYS Consumer grade color
  }
}

export function colorWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export { getLocalApiKey, removeLocalApiKey, saveLocalApiKey } from '@/utils/local-api-key';

export function translateScanProgressMessage(
  msg: string | null | undefined,
  t: (key: string, options?: any) => string,
  detail?: any
): string {
  if (!msg) return '';

  // Try checking the direct key first
  const localKey = `inventoryScanner.apiErrors.${msg}`;
  const options: Record<string, any> = {};
  if (detail) {
    if (detail.group !== undefined) {
      options.group =
        detail.group === 'protected' || detail.group === 16
          ? t('inventoryScanner.lockedGroup', { defaultValue: 't\u1ea1m kh\u00f3a' })
          : t('inventoryScanner.normalGroup', { defaultValue: 'th\u01b0\u1eddng' });
    }
    if (detail.page !== undefined) options.page = detail.page;
    if (detail.count !== undefined) options.count = detail.count;
    if (detail.name !== undefined) options.name = detail.name;
    if (detail.max !== undefined) options.max = detail.max;
    if (detail.round !== undefined) options.round = detail.round;
  }

  const translated = t(localKey, options);
  if (translated !== localKey) {
    return translated;
  }

  // Backward compatibility with raw Vietnamese messages
  if (msg.includes('\u0110ang ch\u1edd qu\u00e9t')) {
    return t('inventoryScanner.apiErrors.waitingScan');
  }
  if (msg.includes('\u0110ang \u0111\u1ecbnh d\u1ea1ng link Steam')) {
    return t('inventoryScanner.apiErrors.formattingSteamLink');
  }
  if (msg.includes('Ki\u1ec3m tra cache')) {
    return t('inventoryScanner.apiErrors.checkingCache');
  }
  if (msg.includes('Ho\u00e0n t\u1ea5t qu\u00e9t (t\u1eeb cache)')) {
    return t('inventoryScanner.apiErrors.scanCompleteFromCache');
  }
  if (msg.includes('Ki\u1ec3m tra c\u1ea5u h\u00ecnh cookie')) {
    return t('inventoryScanner.apiErrors.checkingCookieConfig');
  }
  if (msg.includes('B\u1eaft \u0111\u1ea7u qu\u00e9t h\u00f2m \u0111\u1ed3 t\u1eeb Steam')) {
    return t('inventoryScanner.apiErrors.startingSteamScan');
  }
  if (msg.includes('\u0110ang t\u1ea3i h\u00f2m \u0111\u1ed3')) {
    const groupMatch = msg.includes('th\u01b0\u1eddng')
      ? t('inventoryScanner.normalGroup')
      : t('inventoryScanner.lockedGroup');
    const pageMatch = msg.match(/trang (\d+)/);
    const page = pageMatch ? pageMatch[1] : '1';
    return t('inventoryScanner.apiErrors.loadingInventory', { group: groupMatch, page });
  }
  if (msg.includes('\u0110ang qu\u00e9t v\u1eadt ph\u1ea9m tr\u00ean Market')) {
    const match = msg.match(/đã tìm thấy (\d+) item/);
    const count = match ? match[1] : '0';
    return t('inventoryScanner.apiErrors.scanningMarketListings', { count });
  }
  if (msg.includes('\u0110ang ph\u00e2n t\u00edch c\u00e1c item')) {
    return t('inventoryScanner.apiErrors.analyzingItems');
  }
  if (msg.includes('\u0110ang l\u1ea5y th\u00f4ng tin gi\u00e1')) {
    return t('inventoryScanner.apiErrors.fetchingPriceInfo');
  }
  if (msg.includes('\u0110ang \u0111\u1ecbnh gi\u00e1')) {
    const match = msg.match(/\u0110ang \u0111\u1ecbnh gi\u00e1: (.*)/);
    const name = match ? match[1] : '';
    return t('inventoryScanner.apiErrors.pricingItem', { name });
  }
  if (msg.includes('L\u01b0u k\u1ebft qu\u1ea3 qu\u00e9t')) {
    return t('inventoryScanner.apiErrors.savingScanResult');
  }
  if (msg.includes('Ho\u00e0n t\u1ea5t qu\u00e9t!')) {
    return t('inventoryScanner.apiErrors.scanComplete');
  }
  if (msg === 'creatingScanJob' || msg.includes('\u0110ang t\u1ea3o job qu\u00e9t')) {
    return t('inventoryScanner.apiErrors.creatingScanJob');
  }

  return msg;
}

export function translateAccountError(
  error: string | null | undefined,
  t: (key: string, options?: any) => string
): string {
  if (!error) return '';

  // Structured key checks
  if (error.startsWith('duplicateAccountError:')) {
    const parts = error.substring('duplicateAccountError:'.length).split(',');
    const params: Record<string, string> = {};
    parts.forEach((p) => {
      const [k, v] = p.split('=');
      if (k && v) params[k] = v;
    });
    return t('inventoryScanner.apiErrors.duplicateAccountError', {
      name: params.name || '',
      steamId: params.steamId || '',
    });
  }

  if (error.startsWith('duplicateUrlError:')) {
    const name = error.substring('duplicateUrlError:'.length);
    return t('inventoryScanner.apiErrors.duplicateUrlError', { name });
  }

  if (error.startsWith('cookieSteamIdMismatch:')) {
    const parts = error.substring('cookieSteamIdMismatch:'.length).split(',');
    const params: Record<string, string> = {};
    parts.forEach((p) => {
      const [k, v] = p.split('=');
      if (k && v) params[k] = v;
    });
    return t('inventoryScanner.apiErrors.cookieSteamIdMismatch', {
      cookieSteamId: params.cookieSteamId || '',
      steamId64: params.steamId64 || '',
    });
  }

  if (error.startsWith('familyViewInvalidParentalCookie:')) {
    const debugInfo = decodeURIComponent(
      error.substring('familyViewInvalidParentalCookie:debugInfo='.length)
    );
    return t('inventoryScanner.apiErrors.familyViewInvalidParentalCookie', { debugInfo });
  }

  if (error.startsWith('steamHttpError:')) {
    const status = error.substring('steamHttpError:status='.length);
    return t('inventoryScanner.apiErrors.steamHttpError', { status });
  }

  if (error.startsWith('steamConnectionError:')) {
    const status = error.substring('steamConnectionError:status='.length);
    return t('inventoryScanner.apiErrors.steamConnectionError', { status });
  }

  if (error.startsWith('storageUnitFull:')) {
    const parts = error.substring('storageUnitFull:'.length).split(',');
    const params: Record<string, string> = {};
    parts.forEach((p) => {
      const [k, v] = p.split('=');
      if (k && v) params[k] = v;
    });
    return t('inventoryScanner.apiErrors.storageUnitFull', {
      name: params.name || '',
      currentCount: params.currentCount || '',
      maxCapacity: params.maxCapacity || '',
    });
  }

  if (error.startsWith('storageUnitCapacityExceeded:')) {
    const parts = error.substring('storageUnitCapacityExceeded:'.length).split(',');
    const params: Record<string, string> = {};
    parts.forEach((p) => {
      const [k, v] = p.split('=');
      if (k && v) params[k] = v;
    });
    return t('inventoryScanner.apiErrors.storageUnitCapacityExceeded', {
      name: params.name || '',
      currentCount: params.currentCount || '',
      addingCount: params.addingCount || '',
      maxCapacity: params.maxCapacity || '',
    });
  }

  if (error.startsWith('storageUnitItemsAdded:')) {
    const parts = error.substring('storageUnitItemsAdded:'.length).split(',');
    const params: Record<string, string> = {};
    parts.forEach((p) => {
      const [k, v] = p.split('=');
      if (k && v) params[k] = v;
    });
    return t('inventoryScanner.apiErrors.storageUnitItemsAdded', {
      count: params.count || '',
      name: params.name || '',
    });
  }

  if (error.startsWith('processedMissingItemsResult:')) {
    const parts = error.substring('processedMissingItemsResult:'.length).split(',');
    const params: Record<string, string> = {};
    parts.forEach((p) => {
      const [k, v] = p.split('=');
      if (k && v) params[k] = v;
    });
    return t('inventoryScanner.apiErrors.processedMissingItemsResult', {
      successCount: params.successCount || '',
      totalCount: params.totalCount || '',
    });
  }

  if (error.startsWith('syncedStorageUnitsResult:')) {
    const count = error.substring('syncedStorageUnitsResult:count='.length);
    return t('inventoryScanner.apiErrors.syncedStorageUnitsResult', { count });
  }

  if (error.startsWith('tooManyRequestsWithRetryAfter:')) {
    const retryAfter = error.substring('tooManyRequestsWithRetryAfter:retryAfter='.length);
    return t('inventoryScanner.apiErrors.tooManyRequestsWithRetryAfter', { retryAfter });
  }

  if (error.startsWith('cloudinaryUploadError:')) {
    const message = error.substring('cloudinaryUploadError:message='.length);
    return t('inventoryScanner.apiErrors.cloudinaryUploadError', { message });
  }

  if (error.startsWith('cannotCreateCase:')) {
    const name = error.substring('cannotCreateCase:name='.length);
    return t('inventoryScanner.apiErrors.cannotCreateCase', { name });
  }

  if (error.startsWith('caseNotFoundWithId:')) {
    const caseId = error.substring('caseNotFoundWithId:id='.length);
    return t('inventoryScanner.apiErrors.caseNotFoundWithId', { caseId });
  }

  if (error.startsWith('geminiQuotaExceeded:')) {
    const parts = error.substring('geminiQuotaExceeded:'.length).split(',');
    const params: Record<string, string> = {};
    parts.forEach((p) => {
      const [k, v] = p.split('=');
      if (k && v) params[k] = v;
    });
    const delay = params.retryDelay || params.retryAfter || '';
    const retryText = delay
      ? ` ${t('inventoryScanner.apiErrors.retryAfterText', { defaultValue: 'Retry after around {{delay}}.', delay })}`
      : params.retryText
        ? ` ${params.retryText}`
        : '';
    return t('inventoryScanner.apiErrors.geminiQuotaExceeded', {
      model: params.model || '',
      retryText,
    });
  }

  if (error.startsWith('geminiPayloadRejectedWithReason:')) {
    const reason = error.substring('geminiPayloadRejectedWithReason:reason='.length);
    return t('inventoryScanner.apiErrors.geminiPayloadRejectedWithReason', { reason });
  }

  if (error.startsWith('geminiRecognitionFailedWithReason:')) {
    const reason = error.substring('geminiRecognitionFailedWithReason:reason='.length);
    return t('inventoryScanner.apiErrors.geminiRecognitionFailedWithReason', { reason });
  }

  if (error.startsWith('cannotFindSteamProfile:')) {
    const parts = error.substring('cannotFindSteamProfile:'.length).split(',');
    const params: Record<string, string> = {};
    parts.forEach((p) => {
      const [k, v] = p.split('=');
      if (k && v) params[k] = v;
    });
    return t('inventoryScanner.apiErrors.cannotFindSteamProfile', {
      vanityName: params.vanityName || '',
      status: params.status || '',
    });
  }

  if (error.startsWith('cannotFindSteamId64:')) {
    const vanityName = error.substring('cannotFindSteamId64:vanityName='.length);
    return t('inventoryScanner.apiErrors.cannotFindSteamId64', { vanityName });
  }

  // Try checking the direct key first
  const localKey = `inventoryScanner.apiErrors.${error}`;
  const translated = t(localKey);
  if (translated !== localKey) {
    return translated;
  }

  // Backward compatibility with raw Vietnamese messages
  if (error.includes('Tr\u00f9ng l\u1eb7p v\u1edbi') && error.includes('SteamID64')) {
    const nameMatch = error.match(/Tr\u00f9ng l\u1eb7p v\u1edbi "([^"]+)"/);
    const idMatch = error.match(/SteamID64: ([^)]+)/);
    const name = nameMatch ? nameMatch[1] : '';
    const steamId = idMatch ? idMatch[1] : '';
    return t('inventoryScanner.apiErrors.duplicateAccountError', { name, steamId });
  }

  if (error.includes('URL tr\u00f9ng v\u1edbi')) {
    const nameMatch = error.match(/URL tr\u00f9ng v\u1edbi "([^"]+)"/);
    const name = nameMatch ? nameMatch[1] : '';
    return t('inventoryScanner.apiErrors.duplicateUrlError', { name });
  }

  return error;
}

export function translateSyncMessage(
  msg: string | null | undefined,
  t: (key: string, options?: any) => string,
  detail?: any
): string {
  if (!msg) return '';

  // 1. Structured key checking
  if (msg.startsWith('syncStartingScan:')) {
    const name = msg.substring('syncStartingScan:name='.length);
    return t('dashboard.syncStartingScan', { name });
  }

  if (msg.startsWith('accountCooldown:')) {
    const seconds = parseInt(msg.substring('accountCooldown:seconds='.length) || '0');
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    const timeStr =
      min > 0
        ? t('common.timeMinutesAndSeconds', { min, sec, defaultValue: `${min}m ${sec}s` })
        : t('common.timeSecondsOnly', { sec, defaultValue: `${sec}s` });
    return t('dashboard.accountCooldownMessage', { time: timeStr });
  }

  if (msg.startsWith('syncDoneScan:')) {
    const parts = msg.substring('syncDoneScan:'.length).split(',');
    const params: Record<string, string> = {};
    parts.forEach((p) => {
      const [k, v] = p.split('=');
      if (k && v) params[k] = v;
    });
    return t('dashboard.syncDoneScan', {
      name: params.name || '',
      count: parseInt(params.count || '0'),
    });
  }

  if (msg.startsWith('syncErrorScan:')) {
    const parts = msg.substring('syncErrorScan:'.length).split(',');
    const params: Record<string, string> = {};
    parts.forEach((p) => {
      const [k, v] = p.split('=');
      if (k && v) params[k] = v;
    });
    const rawErr = params.error || '';
    const translatedErr = translateAccountError(rawErr, t);
    return t('dashboard.syncErrorScan', {
      name: params.name || '',
      error: translatedErr,
    });
  }

  if (msg.startsWith('syncImportingItems:')) {
    const count = parseInt(msg.substring('syncImportingItems:count='.length) || '0');
    return t('dashboard.syncImportingItems', { count });
  }

  if (msg.startsWith('syncImportedGroupedItems:')) {
    const count = parseInt(msg.substring('syncImportedGroupedItems:count='.length) || '0');
    return t('dashboard.syncImportedGroupedItems', { count });
  }

  if (msg.startsWith('syncComplete:')) {
    const parts = msg.substring('syncComplete:'.length).split(',');
    const params: Record<string, string> = {};
    parts.forEach((p) => {
      const [k, v] = p.split('=');
      if (k && v) params[k] = v;
    });
    const scanned = params.scanned || '0';
    const total = params.total || '0';
    const imported = params.imported || '0';
    const missingCount = parseInt(params.missingCount || '0');
    const extraCount = parseInt(params.extraCount || '0');

    let changesText = '';
    if (missingCount > 0 && extraCount > 0) {
      changesText =
        ' ' +
        t('dashboard.syncDetectedMissingAndExtra', { missing: missingCount, extra: extraCount });
    } else if (missingCount > 0) {
      changesText = ' ' + t('dashboard.syncDetectedMissingOnly', { count: missingCount });
    } else if (extraCount > 0) {
      changesText = ' ' + t('dashboard.syncDetectedExtraOnly', { count: extraCount });
    }

    return t('dashboard.syncSuccessDetail', { scanned, total, imported }) + changesText;
  }

  if (msg.startsWith('syncSingleComplete:')) {
    const parts = msg.substring('syncSingleComplete:'.length).split(',');
    const params: Record<string, string> = {};
    parts.forEach((p) => {
      const [k, v] = p.split('=');
      if (k && v) params[k] = v;
    });
    const name = params.name || '';
    const missingCount = parseInt(params.missingCount || '0');
    const extraCount = parseInt(params.extraCount || '0');

    let changesText = '';
    if (missingCount > 0 && extraCount > 0) {
      changesText =
        ' ' +
        t('dashboard.syncDetectedMissingAndExtra', { missing: missingCount, extra: extraCount });
    } else if (missingCount > 0) {
      changesText = ' ' + t('dashboard.syncDetectedMissingOnly', { count: missingCount });
    } else if (extraCount > 0) {
      changesText = ' ' + t('dashboard.syncDetectedExtraOnly', { count: extraCount });
    }

    return t('dashboard.syncSingleCompleteDetail', { name }) + changesText;
  }

  // 2. Direct key checks
  const dashboardKey = `dashboard.${msg}`;
  const translatedDashboard = t(dashboardKey, detail);
  if (translatedDashboard !== dashboardKey) {
    return translatedDashboard;
  }

  const apiErrorKey = `inventoryScanner.apiErrors.${msg}`;
  const translatedApiError = t(apiErrorKey, detail);
  if (translatedApiError !== apiErrorKey) {
    return translatedApiError;
  }

  // 3. Fallback compatibility with old Vietnamese progress messages
  if (
    msg.includes('B\u1eaft \u0111\u1ea7u qu\u00e9t h\u00f2m \u0111\u1ed3:') ||
    msg.includes('B\u1eaft \u0111\u1ea7u qu\u00e9t kho \u0111\u1ed3:')
  ) {
    const name = msg.split(':').slice(1).join(':').trim();
    return t('dashboard.syncStartingScan', { name });
  }
  if (msg.includes('Ho\u00e0n t\u1ea5t qu\u00e9t:')) {
    const match = msg.match(/Ho\u00e0n t\u1ea5t qu\u00e9t:\s*([^\(]+)\(([^)]+)\)/);
    const name = match ? match[1].trim() : '';
    const countStr = match ? match[2].replace(/[^0-9]/g, '') : '0';
    return t('dashboard.syncDoneScan', { name, count: parseInt(countStr) });
  }
  if (msg.includes('L\u1ed7i qu\u00e9t')) {
    const match = msg.match(/L\u1ed7i qu\u00e9t\s*([^:]+):\s*(.*)/);
    const name = match ? match[1].trim() : '';
    const error = match ? match[2].trim() : '';
    return t('dashboard.syncErrorScan', { name, error: translateAccountError(error, t) });
  }
  if (msg.includes('\u0110ang import') && msg.includes('item v\u00e0o portfolio')) {
    const countStr = msg.replace(/[^0-9]/g, '');
    return t('dashboard.syncImportingItems', { count: parseInt(countStr) || 0 });
  }
  if (msg.includes('\u0110\u00e3 import') && msg.includes('lo\u1ea1i item v\u00e0o portfolio')) {
    const countStr = msg.replace(/[^0-9]/g, '');
    return t('dashboard.syncImportedGroupedItems', { count: parseInt(countStr) || 0 });
  }

  return msg;
}

export function translateImportProgressMessage(
  msg: string | null | undefined,
  t: (key: string, options?: any) => string
): string {
  if (!msg) return '';

  // 1. Structured key checking
  if (msg.startsWith('importProgressProcessingItems:')) {
    const total = msg.substring('importProgressProcessingItems:total='.length);
    return t('inventoryScanner.apiErrors.importProgressProcessingItems', { total });
  }

  if (msg.startsWith('importProgressProcessingItem:')) {
    const parts = msg.substring('importProgressProcessingItem:'.length).split(',');
    const params: Record<string, string> = {};
    parts.forEach((p) => {
      const [k, v] = p.split('=');
      if (k && v) params[k] = v;
    });
    return t('inventoryScanner.apiErrors.importProgressProcessingItem', {
      current: params.current || '',
      total: params.total || '',
      name: params.name || '',
    });
  }

  if (msg.startsWith('importProgressSavingItems:')) {
    const count = msg.substring('importProgressSavingItems:count='.length);
    return t('inventoryScanner.apiErrors.importProgressSavingItems', { count });
  }

  if (msg.startsWith('importProgressLinkingAccount:')) {
    const parts = msg.substring('importProgressLinkingAccount:'.length).split(',');
    const params: Record<string, string> = {};
    parts.forEach((p) => {
      const [k, v] = p.split('=');
      if (k && v) params[k] = v;
    });
    return t('inventoryScanner.apiErrors.importProgressLinkingAccount', {
      current: params.current || '',
      total: params.total || '',
      name: params.name || '',
    });
  }

  if (msg.startsWith('importDoneSaveResult:')) {
    const parts = msg.substring('importDoneSaveResult:'.length).split(',');
    const params: Record<string, string> = {};
    parts.forEach((p) => {
      const [k, v] = p.split('=');
      if (k && v) params[k] = v;
    });
    const count = parseInt(params.count || '0');
    const skipped = parseInt(params.skipped || '0');
    if (skipped > 0) {
      return t('inventoryScanner.apiErrors.importDoneSaveResultWithSkipped', { count, skipped });
    }
    return t('inventoryScanner.apiErrors.importDoneSaveResult', { count });
  }

  if (msg.startsWith('importErrorCreateCaseFailed:')) {
    const name = msg.substring('importErrorCreateCaseFailed:name='.length);
    return t('inventoryScanner.apiErrors.importErrorCreateCaseFailed', { name });
  }

  if (msg.startsWith('importErrorRowCaseIdNotFound:')) {
    const row = msg.substring('importErrorRowCaseIdNotFound:row='.length);
    return t('inventoryScanner.apiErrors.importErrorRowCaseIdNotFound', { row });
  }

  if (msg.startsWith('importErrorRowCaseNotFound:')) {
    const row = msg.substring('importErrorRowCaseNotFound:row='.length);
    return t('inventoryScanner.apiErrors.importErrorRowCaseNotFound', { row });
  }

  if (msg.startsWith('importErrorRowMissingCaseIdOrName:')) {
    const row = msg.substring('importErrorRowMissingCaseIdOrName:row='.length);
    return t('inventoryScanner.apiErrors.importErrorRowMissingCaseIdOrName', { row });
  }

  if (msg.startsWith('importErrorRowInvalidData:')) {
    const row = msg.substring('importErrorRowInvalidData:row='.length);
    return t('inventoryScanner.apiErrors.importErrorRowInvalidData', { row });
  }

  if (msg.startsWith('importErrorRowInvalidQuantity:')) {
    const row = msg.substring('importErrorRowInvalidQuantity:row='.length);
    return t('inventoryScanner.apiErrors.importErrorRowInvalidQuantity', { row });
  }

  if (msg.startsWith('importErrorRowInvalidPrice:')) {
    const row = msg.substring('importErrorRowInvalidPrice:row='.length);
    return t('inventoryScanner.apiErrors.importErrorRowInvalidPrice', { row });
  }

  if (msg.startsWith('importErrorRowInvalidDate:')) {
    const row = msg.substring('importErrorRowInvalidDate:row='.length);
    return t('inventoryScanner.apiErrors.importErrorRowInvalidDate', { row });
  }

  // 2. Direct key mapping
  const localKey = `inventoryScanner.apiErrors.${msg}`;
  const translated = t(localKey);
  if (translated !== localKey) {
    return translated;
  }

  // 3. Fallback compatibility with old Vietnamese messages
  if (msg.includes('Đang xử lý') && msg.includes('loại item')) {
    const total = msg.replace(/[^0-9]/g, '');
    return t('inventoryScanner.apiErrors.importProgressProcessingItems', { total });
  }
  if (msg.includes('Đang xử lý item')) {
    const match = msg.match(/Đang xử lý item (\d+)\/(\d+):\s*(.*)/);
    const current = match ? match[1] : '';
    const total = match ? match[2] : '';
    const name = match ? match[3] : '';
    return t('inventoryScanner.apiErrors.importProgressProcessingItem', { current, total, name });
  }
  if (msg.includes('Đang lưu') && msg.includes('loại item vào portfolio')) {
    const count = msg.replace(/[^0-9]/g, '');
    return t('inventoryScanner.apiErrors.importProgressSavingItems', { count });
  }
  if (msg.includes('Đang liên kết tài khoản Steam...')) {
    return t('inventoryScanner.apiErrors.importProgressLinkingAccounts');
  }
  if (msg.includes('Đang liên kết tài khoản')) {
    const match = msg.match(/Đang liên kết tài khoản (\d+)\/(\d+):\s*(.*)/);
    const current = match ? match[1] : '';
    const total = match ? match[2] : '';
    const name = match ? match[3] : '';
    return t('inventoryScanner.apiErrors.importProgressLinkingAccount', { current, total, name });
  }
  if (msg.includes('Đã lưu') && msg.includes('loại item vào portfolio cá nhân')) {
    const match = msg.match(/Đã lưu (\d+) loại item vào portfolio cá nhân(?:, bỏ qua (\d+) item)?/);
    const count = match ? parseInt(match[1]) : 0;
    const skipped = match && match[2] ? parseInt(match[2]) : 0;
    if (skipped > 0) {
      return t('inventoryScanner.apiErrors.importDoneSaveResultWithSkipped', { count, skipped });
    }
    return t('inventoryScanner.apiErrors.importDoneSaveResult', { count });
  }

  return msg;
}
