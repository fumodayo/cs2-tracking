import { createServices } from '@/infrastructure/container';
import { getSteamCaseImageUrl } from '@/infrastructure/cases/steam-case-image-provider';
import { resolveSteamId } from '@/infrastructure/steam';

import { updateScanJob } from '@/services/scan-job-store';
import {
  CachedScanResult,
  ScanItem,
  SteamProfile,
  ensureCacheIndexes,
  getCachedScan,
  saveScanToCache,
  getNextExpiry,
} from '@/services/scan-cache';
import { buildCachedScanJobResult } from '@/services/scan-cached-result';
import {
  fetchScanWalletBalance,
  persistScanAccountCookieError,
  persistSuccessfulScanAccountState,
} from '@/services/scan-service-account-state';
import { buildFailedLiveScanFallbackScopes } from '@/services/scan-cache-fallback';
import { analyzeSteamInventoryItems } from '@/services/scan-service-inventory-analysis';
import {
  buildSteamCookieHeader,
  buildSteamInventoryHeaders,
  parseSteamScanCookie,
  validateSteamCookieSession,
} from '@/services/scan-steam-auth';
import { fetchSteamInventorySnapshot } from '@/services/scan-steam-inventory';
import { mapWithConcurrency } from '@/services/parser/utils';
import { STEAM_IMAGE_CDN, getMarketHashNameLookupKey } from '@/services/scan-accessories';
import type { CaseItem } from '@/domain/case-item';

const INVENTORY_PRICE_CONCURRENCY = 4;

type InventoryPriceInfo = {
  caseItem: CaseItem | null;
  imageUrl: string | null;
  price: number;
};

export async function runScanJob(
  jobId: string,
  params: {
    steamUrl: string;
    steamCookie?: string;
    forceRefresh?: boolean;
    ownerId?: string;
  }
) {
  const { steamUrl, steamCookie, forceRefresh, ownerId } = params;
  let steamId64: string | undefined;
  let requestHasCookie = false;
  try {
    updateScanJob(jobId, {
      status: 'running',
      percent: 5,
      message: 'formattingSteamLink',
    });

    // Bước 1: Resolve thành SteamID64 và thông tin hồ sơ
    let profile: SteamProfile;
    try {
      const resolved = await resolveSteamId(steamUrl);
      steamId64 = resolved.steamId64;
      profile = resolved.profile;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'invalidSteamLink');
    }

    updateScanJob(jobId, { percent: 15, message: 'checkingCache' });

    // Bước 2: Kiểm tra cache trừ khi ép refresh
    await ensureCacheIndexes();
    requestHasCookie = !!steamCookie && steamCookie.trim().length > 0;
    const cacheScope = { steamId64, ownerId, hasCookie: requestHasCookie };

    if (!forceRefresh) {
      const cached = await getCachedScan(cacheScope);
      if (cached) {
        updateScanJob(jobId, {
          status: 'done',
          percent: 100,
          message: 'scanCompleteFromCache',
          result: buildCachedScanJobResult({
            cached,
            profile,
            includePrivateFields: requestHasCookie,
            normalizeItems: true,
          }),
        });
        return;
      }
    }

    // Bước 2.5: Validate cookie nếu được cung cấp
    let hasCookie = false;
    let cookieHeader: string | undefined;
    if (steamCookie && steamCookie.trim()) {
      updateScanJob(jobId, {
        percent: 20,
        message: 'checkingCookieConfig',
      });
      const cookieParts = parseSteamScanCookie(steamCookie, steamId64);
      cookieHeader = buildSteamCookieHeader(cookieParts);
      await validateSteamCookieSession({ cookieHeader, steamId64, ownerId });

      hasCookie = true;
    }

    updateScanJob(jobId, {
      percent: 30,
      message: 'startingSteamScan',
    });

    const steamHeaders = buildSteamInventoryHeaders(steamId64, cookieHeader);
    const {
      assets: allAssets,
      descriptions: allDescriptions,
      assetProperties: allAssetProperties,
      totalInventoryCount,
      marketScanWarning,
    } = await fetchSteamInventorySnapshot({
      jobId,
      steamId64,
      ownerId,
      hasCookie,
      steamHeaders,
    });

    updateScanJob(jobId, {
      percent: 55,
      message: 'analyzingItems',
    });

    const { cs2Items, storageUnits } = await analyzeSteamInventoryItems({
      jobId,
      steamId64,
      assets: allAssets,
      descriptions: allDescriptions,
      assetProperties: allAssetProperties,
    });

    updateScanJob(jobId, { percent: 65, message: 'fetchingPriceInfo' });

    const { caseRepository, priceService } = createServices();
    const items: ScanItem[] = [];
    let totalPrice = 0;
    let totalQuantity = 0;

    const cs2Keys = Object.keys(cs2Items);
    const uniqueMarketHashNames = Array.from(
      new Set(cs2Keys.map((key) => cs2Items[key].marketHashName))
    );
    const iconUrlByMarketHashName = new Map<string, string>();
    // Giữ URL icon Steam cho vật phẩm ngoài chưa rõ để UI vẫn render được thumbnail.
    for (const key of cs2Keys) {
      const item = cs2Items[key];
      if (item.iconUrl && !iconUrlByMarketHashName.has(item.marketHashName)) {
        iconUrlByMarketHashName.set(item.marketHashName, item.iconUrl);
      }
    }
    const caseItemsByMarketHashName =
      await caseRepository.findByMarketHashNames(uniqueMarketHashNames);
    const priceLookupItems: CaseItem[] = uniqueMarketHashNames.map(
      (marketHashName) =>
        caseItemsByMarketHashName.get(getMarketHashNameLookupKey(marketHashName)) ?? {
          id: `ext_${marketHashName}`,
          name: marketHashName,
          marketHashName,
          isActive: false,
        }
    );
    const priceLookupItemByMarketHashName = new Map(
      uniqueMarketHashNames.map((marketHashName, index) => [
        marketHashName,
        priceLookupItems[index],
      ])
    );
    let completedPricingCount = 0;
    const priceSnapshotsByItemId = await priceService.getCurrentPrices(priceLookupItems, {
      preferFallback: true,
      concurrency: INVENTORY_PRICE_CONCURRENCY,
      onProgress: (caseItem) => {
        completedPricingCount += 1;
        updateScanJob(jobId, {
          percent:
            65 +
            Math.round((completedPricingCount / Math.max(uniqueMarketHashNames.length, 1)) * 30),
          message: 'pricingItem',
          detail: { name: caseItem.marketHashName },
        });
      },
    });

    const priceEntries = await mapWithConcurrency(
      uniqueMarketHashNames,
      INVENTORY_PRICE_CONCURRENCY,
      async (marketHashName): Promise<[string, InventoryPriceInfo]> => {
        const caseItem =
          caseItemsByMarketHashName.get(getMarketHashNameLookupKey(marketHashName)) ?? null;
        const priceItem = caseItem ?? priceLookupItemByMarketHashName.get(marketHashName);
        const price = priceItem ? (priceSnapshotsByItemId.get(priceItem.id)?.price ?? 0) : 0;
        let imageUrl: string | null = caseItem?.imageUrl ?? null;

        if (!caseItem) {
          // Vật phẩm inventory chưa rõ được định giá qua lookup fallback và nhận ảnh best-effort.
          const itemIconUrl = iconUrlByMarketHashName.get(marketHashName);
          if (itemIconUrl) {
            imageUrl = `${STEAM_IMAGE_CDN}/${itemIconUrl}/360fx360f`;
          } else {
            try {
              imageUrl = await getSteamCaseImageUrl(marketHashName);
            } catch {
              /* ignore */
            }
          }
        }

        return [marketHashName, { caseItem, imageUrl, price }];
      }
    );
    const priceInfoByMarketHashName = new Map(priceEntries);

    for (let i = 0; i < cs2Keys.length; i++) {
      const cs2Key = cs2Keys[i];
      const {
        marketHashName,
        count,
        itemType,
        iconUrl,
        rarity,
        holdDays,
        tradeHoldUntil,
        tradeProtected,
        onMarket,
        dopplerPhase,
        inspectLink,
        patternInfo,
      } = cs2Items[cs2Key];
      const priceInfo = priceInfoByMarketHashName.get(marketHashName);
      const caseItem = priceInfo?.caseItem ?? null;
      const imageUrl =
        priceInfo?.imageUrl ?? (iconUrl ? `${STEAM_IMAGE_CDN}/${iconUrl}/360fx360f` : null);
      const price = priceInfo?.price ?? 0;

      items.push({
        caseItem: caseItem
          ? { ...caseItem, imageUrl: caseItem.imageUrl ?? null }
          : {
              id: `ext_${marketHashName}`,
              name: marketHashName,
              marketHashName,
              imageUrl,
              isActive: false,
            },
        type: itemType,
        rarity,
        steamMarketUrl: `https://steamcommunity.com/market/listings/730/${encodeURIComponent(marketHashName)}`,
        quantity: count,
        price,
        total: price * count,
        holdDays: holdDays > 0 ? holdDays : undefined,
        tradeHoldUntil: holdDays > 0 ? tradeHoldUntil : undefined,
        tradeProtected: tradeProtected || undefined,
        onMarket: onMarket || undefined,
        dopplerPhase,
        inspectLink,
        patternInfo,
      });

      totalPrice += price * count;
      totalQuantity += count;
    }

    const finalTotalInventoryCount = totalInventoryCount || allAssets.length;
    const now = new Date();
    const expiresAt = getNextExpiry();

    updateScanJob(jobId, { percent: 98, message: 'savingScanResult' });

    const { walletRaw, walletVnd } = await fetchScanWalletBalance({ hasCookie, cookieHeader });

    const scanResult: CachedScanResult = {
      steamId64,
      profile,
      items,
      totalPrice,
      totalQuantity,
      totalInventoryCount: finalTotalInventoryCount,
      scannedAt: now,
      expiresAt,
      marketScanWarning,
      hasCookie,
      ...(hasCookie
        ? {
            storageUnits,
            walletBalance: walletRaw,
            walletBalanceVnd: walletVnd,
          }
        : {}),
    };

    // Cache toàn bộ kết quả private, nhưng sau đó chỉ lộ trường private cho request có cookie.
    await saveScanToCache({ steamId64, ownerId, hasCookie }, scanResult);

    await persistSuccessfulScanAccountState({
      hasCookie,
      ownerId,
      steamId64,
      walletRaw,
      walletVnd,
    });

    updateScanJob(jobId, {
      status: 'done',
      percent: 100,
      message: 'scanComplete',
      result: {
        steamId64,
        profile,
        items,
        totalPrice,
        totalQuantity,
        totalInventoryCount: finalTotalInventoryCount,
        cached: false,
        scannedAt: now,
        expiresAt,
        marketScanWarning,
        storageUnits: hasCookie ? storageUnits : [],
        ...(hasCookie
          ? {
              walletBalance: walletRaw,
              walletBalanceVnd: walletVnd,
            }
          : {}),
      },
    });
  } catch (err) {
    console.error('Scan job error:', err);
    await persistScanAccountCookieError({ ownerId, steamId64, error: err });

    if (steamId64) {
      try {
        // Nếu fetch Steam trực tiếp fail, trả cache hết hạn gần nhất để UI vẫn dùng được.
        const fallbackScopes = buildFailedLiveScanFallbackScopes({
          steamId64,
          ownerId,
          requestHasCookie,
        });

        for (const fallback of fallbackScopes) {
          const expiredCache = await getCachedScan(fallback.scope, { ignoreExpiry: true });
          if (expiredCache) {
            console.warn(
              `[InventoryScanner] Live scan failed, falling back to cache for ${steamId64}. Error:`,
              err
            );
            updateScanJob(jobId, {
              status: 'done',
              percent: 100,
              message: 'fallbackToCache',
              result: buildCachedScanJobResult({
                cached: expiredCache,
                includePrivateFields: fallback.includePrivateFields,
              }),
            });
            return;
          }
        }
      } catch (fallbackErr) {
        console.error('Failed to fetch expired cache fallback:', fallbackErr);
      }
    }

    updateScanJob(jobId, {
      status: 'error',
      percent: 100,
      message: err instanceof Error ? err.message : 'errScanInventory',
      error: err instanceof Error ? err.message : 'errScanInventory',
    });
  }
}
