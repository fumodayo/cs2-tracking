type TranslationOptions = Record<string, unknown>;
type TranslationFn = (key: string, options?: TranslationOptions) => string;
type ProgressDetail = Record<string, string | number | boolean | undefined>;

function parseStructuredParams(value: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const part of value.split(',')) {
    const [key, paramValue] = part.split('=');
    if (key && paramValue) {
      params[key] = paramValue;
    }
  }
  return params;
}

export function translateScanProgressMessage(
  msg: string | null | undefined,
  t: TranslationFn,
  detail?: ProgressDetail
): string {
  if (!msg) return '';

  // Thử kiểm tra key trực tiếp trước
  const localKey = `inventoryScanner.apiErrors.${msg}`;
  const options: TranslationOptions = {};
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

  // Tương thích ngược với message tiếng Việt dạng thô
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

export function translateAccountError(error: string | null | undefined, t: TranslationFn): string {
  if (!error) return '';

  if (isFamilyViewAccountError(error)) {
    if (error.includes('familyViewCookieRequired')) {
      return t('inventoryScanner.apiErrors.familyViewCookieRequired');
    }
    return t('inventoryScanner.apiErrors.familyViewInvalidParentalCookie');
  }

  // Kiểm tra key có cấu trúc
  if (error.startsWith('duplicateAccountError:')) {
    const params = parseStructuredParams(error.substring('duplicateAccountError:'.length));
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
    const params = parseStructuredParams(error.substring('cookieSteamIdMismatch:'.length));
    return t('inventoryScanner.apiErrors.cookieSteamIdMismatch', {
      cookieSteamId: params.cookieSteamId || '',
      steamId64: params.steamId64 || '',
    });
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
    const params = parseStructuredParams(error.substring('storageUnitFull:'.length));
    return t('inventoryScanner.apiErrors.storageUnitFull', {
      name: params.name || '',
      currentCount: params.currentCount || '',
      maxCapacity: params.maxCapacity || '',
    });
  }

  if (error.startsWith('storageUnitCapacityExceeded:')) {
    const params = parseStructuredParams(error.substring('storageUnitCapacityExceeded:'.length));
    return t('inventoryScanner.apiErrors.storageUnitCapacityExceeded', {
      name: params.name || '',
      currentCount: params.currentCount || '',
      addingCount: params.addingCount || '',
      maxCapacity: params.maxCapacity || '',
    });
  }

  if (error.startsWith('storageUnitItemsAdded:')) {
    const params = parseStructuredParams(error.substring('storageUnitItemsAdded:'.length));
    return t('inventoryScanner.apiErrors.storageUnitItemsAdded', {
      count: params.count || '',
      name: params.name || '',
    });
  }

  if (error.startsWith('processedMissingItemsResult:')) {
    const params = parseStructuredParams(error.substring('processedMissingItemsResult:'.length));
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
    const params = parseStructuredParams(error.substring('geminiQuotaExceeded:'.length));
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
    const params = parseStructuredParams(error.substring('cannotFindSteamProfile:'.length));
    return t('inventoryScanner.apiErrors.cannotFindSteamProfile', {
      vanityName: params.vanityName || '',
      status: params.status || '',
    });
  }

  if (error.startsWith('cannotFindSteamId64:')) {
    const vanityName = error.substring('cannotFindSteamId64:vanityName='.length);
    return t('inventoryScanner.apiErrors.cannotFindSteamId64', { vanityName });
  }

  // Thử kiểm tra key trực tiếp trước
  const localKey = `inventoryScanner.apiErrors.${error}`;
  const translated = t(localKey);
  if (translated !== localKey) {
    return translated;
  }

  // Tương thích ngược với message tiếng Việt dạng thô
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

export function isFamilyViewAccountError(error: string | null | undefined): boolean {
  if (!error) return false;

  const normalized = safeDecodeURIComponent(error).toLowerCase();
  return (
    normalized.includes('familyview') ||
    normalized.includes('family view') ||
    normalized.includes('steamparental')
  );
}

export function isCookieCredentialError(error: string | null | undefined): boolean {
  if (!error || isFamilyViewAccountError(error)) return false;

  const normalized = safeDecodeURIComponent(error).toLowerCase();
  return (
    normalized.includes('cookie') ||
    normalized.includes('session') ||
    normalized.includes('hết hạn') ||
    normalized.includes('expired') ||
    normalized.includes('unauthorized') ||
    normalized.includes('login required') ||
    normalized.includes('privateinventory')
  );
}

export function isPrivateInventoryAccountError(error: string | null | undefined): boolean {
  if (!error) return false;

  const normalized = safeDecodeURIComponent(error).toLowerCase();
  return (
    normalized.includes('privateinventory') ||
    normalized.includes('emptyorprivateinventory') ||
    normalized.includes('private inventory') ||
    normalized.includes('inventory is private') ||
    normalized.includes('inventory may be private') ||
    normalized.includes('inventory đang private') ||
    normalized.includes('hòm đồ đang riêng tư') ||
    normalized.includes('hòm đồ có thể đang riêng tư')
  );
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function translateSyncMessage(
  msg: string | null | undefined,
  t: TranslationFn,
  detail?: ProgressDetail
): string {
  if (!msg) return '';

  // 1. Kiểm tra key có cấu trúc
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
    const params = parseStructuredParams(msg.substring('syncDoneScan:'.length));
    return t('dashboard.syncDoneScan', {
      name: params.name || '',
      count: parseInt(params.count || '0'),
    });
  }

  if (msg.startsWith('syncErrorScan:')) {
    const params = parseStructuredParams(msg.substring('syncErrorScan:'.length));
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
    const params = parseStructuredParams(msg.substring('syncComplete:'.length));
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
    const params = parseStructuredParams(msg.substring('syncSingleComplete:'.length));
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

  // 2. Kiểm tra key trực tiếp
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

  // 3. Dự phòng tương thích với message tiến độ tiếng Việt cũ
  if (
    msg.includes('B\u1eaft \u0111\u1ea7u qu\u00e9t h\u00f2m \u0111\u1ed3:') ||
    msg.includes('B\u1eaft \u0111\u1ea7u qu\u00e9t kho \u0111\u1ed3:')
  ) {
    const name = msg.split(':').slice(1).join(':').trim();
    return t('dashboard.syncStartingScan', { name });
  }
  if (msg.includes('Ho\u00e0n t\u1ea5t qu\u00e9t:')) {
    const match = msg.match(/Ho\u00e0n t\u1ea5t qu\u00e9t:\s*([^(]+)\(([^)]+)\)/);
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
  t: TranslationFn
): string {
  if (!msg) return '';

  // 1. Kiểm tra key có cấu trúc
  if (msg.startsWith('importProgressProcessingItems:')) {
    const total = msg.substring('importProgressProcessingItems:total='.length);
    return t('inventoryScanner.apiErrors.importProgressProcessingItems', { total });
  }

  if (msg.startsWith('importProgressProcessingItem:')) {
    const params = parseStructuredParams(msg.substring('importProgressProcessingItem:'.length));
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
    const params = parseStructuredParams(msg.substring('importProgressLinkingAccount:'.length));
    return t('inventoryScanner.apiErrors.importProgressLinkingAccount', {
      current: params.current || '',
      total: params.total || '',
      name: params.name || '',
    });
  }

  if (msg.startsWith('importDoneSaveResult:')) {
    const params = parseStructuredParams(msg.substring('importDoneSaveResult:'.length));
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

  // 2. Mapping key trực tiếp
  const localKey = `inventoryScanner.apiErrors.${msg}`;
  const translated = t(localKey);
  if (translated !== localKey) {
    return translated;
  }

  // 3. Dự phòng tương thích với message tiếng Việt cũ
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
