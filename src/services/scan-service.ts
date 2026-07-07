import { getDatabase } from '@/infrastructure/db/mongo-client';
import { createServices } from '@/infrastructure/container';
import { getSteamCaseImageUrl } from '@/infrastructure/cases/steam-case-image-provider';
import { resolveSteamId, fetchSteamWalletBalance } from '@/infrastructure/steam';
import type { StorageUnitInfo } from '@/domain/storage-unit';

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
import { analyzeItemStatus } from '@/services/scan-steam-fetcher';
import {
  buildSteamCookieHeader,
  buildSteamInventoryHeaders,
  parseSteamScanCookie,
  validateSteamCookieSession,
} from '@/services/scan-steam-auth';
import { fetchSteamInventorySnapshot } from '@/services/scan-steam-inventory';
import { decodeInspectLink } from '@/services/pattern/inspect-link-decoder';
import { analyzePattern } from '@/services/pattern/pattern-analyzer';
import { buildInspectLink } from '@/services/pattern/inspect-link-builder';
import { mapWithConcurrency } from '@/services/parser/utils';
import {
  STEAM_IMAGE_CDN,
  enrichPatternInfoWithSteamStickerDescriptions,
  getMarketHashNameLookupKey,
  parseAccessoryDescriptions,
} from '@/services/scan-accessories';
import {
  getDopplerPhaseFromDescription,
  getRarityFromDescription,
  isStorageUnitDescription,
  shouldIncludeSteamDescription,
} from '@/services/scan-item-metadata';
import type { CaseItem } from '@/domain/case-item';
import type { PatternInfo } from '@/domain/pattern-info';
import { inferInventoryItemType, type Cs2InventoryItemType } from '@/utils/cs2-item-type';

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

    // Step 1: Resolve to SteamID64 + profile info
    let profile: SteamProfile;
    try {
      const resolved = await resolveSteamId(steamUrl);
      steamId64 = resolved.steamId64;
      profile = resolved.profile;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'invalidSteamLink');
    }

    updateScanJob(jobId, { percent: 15, message: 'checkingCache' });

    // Step 2: Check cache (unless force refresh)
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

    // Step 2.5: Validate Cookie if provided
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

    const itemCounts: Record<string, { count: number; onMarket: boolean }> = {};
    const assetsByDescKey = new Map<string, Array<(typeof allAssets)[number]>>();
    const assetsByDescStatusKey = new Map<string, Array<(typeof allAssets)[number]>>();
    for (const [assetIndex, asset] of allAssets.entries()) {
      const statusSuffix = asset.onMarket ? '_onMarket' : '_normal';
      const descKey = `${asset.classid}_${asset.instanceid}`;
      const key = `${asset.classid}_${asset.instanceid}${statusSuffix}`;
      const amount = parseInt(asset.amount, 10) || 1;

      const descAssets = assetsByDescKey.get(descKey);
      if (descAssets) {
        descAssets.push(asset);
      } else {
        assetsByDescKey.set(descKey, [asset]);
      }

      const statusAssets = assetsByDescStatusKey.get(key);
      if (statusAssets) {
        statusAssets.push(asset);
      } else {
        assetsByDescStatusKey.set(key, [asset]);
      }

      if (!itemCounts[key]) {
        itemCounts[key] = { count: 0, onMarket: !!asset.onMarket };
      }
      itemCounts[key].count += amount;

      if ((assetIndex + 1) % 1000 === 0) {
        updateScanJob(jobId, {
          percent: 56,
          message: 'analyzingItems',
          detail: { count: assetIndex + 1, total: allAssets.length },
        });
      }
    }

    const descMap = new Map<string, (typeof allDescriptions)[0]>();
    for (const desc of allDescriptions) {
      const key = `${desc.classid}_${desc.instanceid}`;
      if (!descMap.has(key)) descMap.set(key, desc);
    }

    const assetPropertiesMap = new Map<
      string,
      Array<{
        propertyid: number;
        int_value?: string;
        float_value?: string;
        string_value?: string;
        name?: string;
      }>
    >();
    for (const ap of allAssetProperties) {
      if (ap.assetid && ap.asset_properties) {
        assetPropertiesMap.set(ap.assetid, ap.asset_properties);
      }
    }

    const cs2Items: Record<
      string,
      {
        marketHashName: string;
        count: number;
        itemType: Cs2InventoryItemType;
        iconUrl: string | null;
        rarity?: { name: string; color: string };
        holdDays: number;
        tradeHoldUntil?: string;
        tradeProtected: boolean;
        onMarket: boolean;
        dopplerPhase?: string;
        inspectLink?: string;
        patternInfo?: PatternInfo;
      }
    > = {};

    const storageUnits: StorageUnitInfo[] = [];
    const itemCountEntries = Object.entries(itemCounts);
    let analyzedGroupCount = 0;
    let analyzedTargetCount = 0;
    const updateAnalyzeProgress = () => {
      updateScanJob(jobId, {
        percent: 56 + Math.round((analyzedGroupCount / Math.max(itemCountEntries.length, 1)) * 8),
        message: 'analyzingItems',
        detail: {
          count: analyzedGroupCount,
          total: itemCountEntries.length,
          assets: analyzedTargetCount,
        },
      });
    };

    for (const [key, info] of itemCountEntries) {
      analyzedGroupCount += 1;
      if (analyzedGroupCount === 1 || analyzedGroupCount % 25 === 0) {
        updateAnalyzeProgress();
      }

      const parts = key.split('_');
      const classid = parts[0];
      const instanceid = parts[1];
      const descKey = `${classid}_${instanceid}`;

      const desc = descMap.get(descKey);
      if (!desc) continue;

      const isStorageUnit = isStorageUnitDescription(desc);

      if (isStorageUnit) {
        const relatedAssets = assetsByDescKey.get(descKey) ?? [];
        for (const asset of relatedAssets) {
          storageUnits.push({
            assetId: asset.assetid,
            name: desc.name || 'Storage Unit',
            iconUrl: desc.icon_url ? `${STEAM_IMAGE_CDN}/${desc.icon_url}/360fx360f` : null,
          });
        }
        continue;
      }

      const { holdDays, tradeProtected, tradeHoldUntil } = analyzeItemStatus(desc);
      const isTradeLocked = holdDays > 0;
      const isSpecialState = isTradeLocked || tradeProtected || info.onMarket;

      if (!shouldIncludeSteamDescription(desc, isSpecialState)) continue;

      const itemType = inferInventoryItemType({
        name: desc.name,
        marketHashName: desc.market_hash_name,
        steamType: desc.type,
        tags: desc.tags,
      });

      const rarity = getRarityFromDescription(desc);
      const dopplerPhase = getDopplerPhaseFromDescription(desc);

      const relatedAssets = assetsByDescStatusKey.get(key) ?? [];
      const firstAsset = relatedAssets[0];
      const inspectAction = desc.actions?.find((a) => a.link?.includes('csgo_econ_action_preview'));
      const accessoryDescriptions = parseAccessoryDescriptions([
        ...(desc.descriptions ?? []),
        ...(desc.owner_descriptions ?? []),
      ]);
      const scanTargets =
        itemType === 'Skin'
          ? relatedAssets.map((asset) => ({
              asset,
              count: parseInt(asset.amount, 10) || 1,
            }))
          : [{ asset: firstAsset, count: info.count }];

      for (const [targetIndex, target] of scanTargets.entries()) {
        analyzedTargetCount += 1;
        if (analyzedTargetCount % 100 === 0) {
          updateAnalyzeProgress();
        }

        const targetAsset = target.asset;
        const props = targetAsset ? assetPropertiesMap.get(targetAsset.assetid) : undefined;
        const itemCert = props?.find((p) => p.propertyid === 6)?.string_value;
        let inspectLink: string | undefined;
        if (inspectAction?.link && targetAsset) {
          inspectLink = buildInspectLink(
            inspectAction.link,
            steamId64,
            targetAsset.assetid,
            itemCert
          );
        }

        let patternInfo: PatternInfo | undefined;
        if (itemType === 'Skin') {
          const decodedInspect = inspectLink ? decodeInspectLink(inspectLink) : null;
          const propPaintSeed = props?.find((p) => p.propertyid === 1)?.int_value;
          const propFloatValue = props?.find((p) => p.propertyid === 2)?.float_value;

          if (propPaintSeed) {
            try {
              const paintSeed = parseInt(propPaintSeed, 10);
              const floatValue = propFloatValue ? parseFloat(propFloatValue) : undefined;
              const paintIndex = decodedInspect?.paintIndex;

              patternInfo = await analyzePattern(
                desc.market_hash_name,
                paintSeed,
                floatValue,
                paintIndex,
                dopplerPhase,
                {
                  stickers: decodedInspect?.stickers,
                  keychains: decodedInspect?.keychains,
                }
              );
              patternInfo = enrichPatternInfoWithSteamStickerDescriptions(
                patternInfo,
                accessoryDescriptions.stickers,
                accessoryDescriptions.charms
              );
            } catch (err) {
              console.debug('[scan-service] Failed to analyze pattern from asset properties:', err);
            }
          }

          if (!patternInfo && decodedInspect) {
            try {
              patternInfo = await analyzePattern(
                desc.market_hash_name,
                decodedInspect.paintSeed,
                decodedInspect.floatValue,
                decodedInspect.paintIndex,
                dopplerPhase,
                {
                  stickers: decodedInspect.stickers,
                  keychains: decodedInspect.keychains,
                }
              );
              patternInfo = enrichPatternInfoWithSteamStickerDescriptions(
                patternInfo,
                accessoryDescriptions.stickers,
                accessoryDescriptions.charms
              );
            } catch (err) {
              console.debug('[scan-service] Failed to decode/analyze pattern during scan:', err);
            }
          }
        }

        const stateKey = info.onMarket
          ? 'onMarket'
          : tradeProtected
            ? 'tradeProtected'
            : holdDays > 0
              ? 'hold'
              : 'normal';
        const assetKey =
          itemType === 'Skin'
            ? (targetAsset?.assetid ?? inspectLink ?? `skin-${targetIndex}`)
            : 'stack';
        const cs2Key = `${desc.market_hash_name}_${dopplerPhase || ''}_${stateKey}_${assetKey}`;

        if (!cs2Items[cs2Key]) {
          cs2Items[cs2Key] = {
            marketHashName: desc.market_hash_name,
            count: 0,
            itemType,
            iconUrl: desc.icon_url ?? null,
            rarity,
            holdDays,
            tradeHoldUntil,
            tradeProtected,
            onMarket: info.onMarket,
            dopplerPhase,
            inspectLink,
            patternInfo,
          };
        } else {
          cs2Items[cs2Key].holdDays = Math.max(cs2Items[cs2Key].holdDays, holdDays);
          if (tradeHoldUntil) {
            const curVal = cs2Items[cs2Key].tradeHoldUntil;
            if (!curVal || new Date(tradeHoldUntil).getTime() > new Date(curVal).getTime()) {
              cs2Items[cs2Key].tradeHoldUntil = tradeHoldUntil;
            }
          }
        }
        cs2Items[cs2Key].count += target.count;
      }
    }

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

    let walletRaw: string | null = null;
    let walletVnd: number | null = null;
    if (hasCookie && cookieHeader) {
      try {
        const walletResult = await fetchSteamWalletBalance(cookieHeader);
        if (walletResult) {
          walletRaw = walletResult.raw;
          walletVnd = walletResult.vnd;
        } else {
          walletRaw = 'walletBalanceNotFound';
        }
      } catch (walletErr) {
        console.error('Failed to fetch steam wallet balance:', walletErr);
        walletRaw = `walletBalanceError:message=${walletErr instanceof Error ? walletErr.message : String(walletErr)}`;
      }
    }

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

    await saveScanToCache({ steamId64, ownerId, hasCookie }, scanResult);

    if (hasCookie && ownerId && ownerId !== 'guest') {
      try {
        const db = await getDatabase();
        const updateDoc: Record<string, unknown> = { cookieError: null };
        if (walletRaw !== null) {
          updateDoc.walletBalance = walletRaw;
          updateDoc.walletBalanceVnd = walletVnd;
        }
        await db
          .collection('portfolio_accounts')
          .updateOne({ steamId64, ownerId }, { $set: updateDoc });
      } catch {
        /* ignore */
      }
    }

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
    if (ownerId && steamId64 && ownerId !== 'guest') {
      const isCookieError =
        err instanceof Error &&
        (err.message.includes('Cookie') ||
          err.message.includes('cookie') ||
          err.message.includes('privateInventory') ||
          err.message.includes('Family View') ||
          err.message.includes('familyView'));
      if (isCookieError) {
        try {
          const db = await getDatabase();
          await db
            .collection('portfolio_accounts')
            .updateOne({ steamId64, ownerId }, { $set: { cookieError: err.message } });
        } catch {
          /* ignore */
        }
      }
    }

    if (steamId64) {
      try {
        const expiredCache = await getCachedScan(
          { steamId64, ownerId, hasCookie: requestHasCookie },
          { ignoreExpiry: true }
        );
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
              includePrivateFields: requestHasCookie,
            }),
          });
          return;
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

function buildCachedScanJobResult({
  cached,
  includePrivateFields,
  profile,
  normalizeItems = false,
}: {
  cached: CachedScanResult;
  includePrivateFields: boolean;
  profile?: SteamProfile;
  normalizeItems?: boolean;
}) {
  const items = normalizeItems ? normalizeScanItemTypes(cached.items) : cached.items;

  return {
    steamId64: cached.steamId64,
    profile: cached.profile ?? profile,
    items,
    totalPrice: cached.totalPrice,
    totalQuantity: cached.totalQuantity,
    totalInventoryCount: cached.totalInventoryCount,
    cached: true,
    scannedAt: cached.scannedAt,
    expiresAt: cached.expiresAt,
    marketScanWarning: cached.marketScanWarning,
    storageUnits: includePrivateFields ? (cached.storageUnits ?? []) : [],
    ...(includePrivateFields
      ? {
          walletBalance: cached.walletBalance,
          walletBalanceVnd: cached.walletBalanceVnd,
        }
      : {}),
  };
}

function normalizeScanItemTypes(items: ScanItem[]): ScanItem[] {
  return items.map((item) => {
    const inferredType = inferInventoryItemType({
      name: item.caseItem.name,
      marketHashName: item.caseItem.marketHashName,
    });

    return item.type === inferredType ? item : { ...item, type: inferredType };
  });
}
