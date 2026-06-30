import { getDatabase } from '@/infrastructure/db/mongo-client';
import { createServices } from '@/infrastructure/container';
import { getSteamCaseImageUrl } from '@/infrastructure/cases/steam-case-image-provider';
import { resolveSteamId, fetchSteamWalletBalance } from '@/infrastructure/steam';
import { parseSteamCookies } from '@/utils/steam-cookies';
import { USER_AGENTS } from '@/utils/api-client';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout';
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
import { extractSteamIdFromCookie, analyzeItemStatus } from '@/services/scan-steam-fetcher';
import { decodeInspectLink } from '@/services/pattern/inspect-link-decoder';
import { analyzePattern } from '@/services/pattern/pattern-analyzer';
import { buildInspectLink } from '@/services/pattern/inspect-link-builder';
import { mapWithConcurrency } from '@/services/parser/utils';
import type { CaseItem } from '@/domain/case-item';
import type { PatternInfo } from '@/domain/pattern-info';

const STEAM_IMAGE_CDN = 'https://community.cloudflare.steamstatic.com/economy/image';
const INVENTORY_PRICE_CONCURRENCY = 4;
const STEAM_COOKIE_VALIDATE_TIMEOUT_MS = 12_000;
const STEAM_INVENTORY_FETCH_TIMEOUT_MS = 25_000;
const STEAM_MARKET_LISTINGS_TIMEOUT_MS = 20_000;

type SteamDescription = {
  type: string;
  value: string;
  color?: string;
};

type ParsedStickerDescription = {
  name: string;
  marketHashName: string;
  imageUrl?: string;
};

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
          result: {
            steamId64: cached.steamId64,
            profile: cached.profile ?? profile,
            items: cached.items,
            totalPrice: cached.totalPrice,
            totalQuantity: cached.totalQuantity,
            totalInventoryCount: cached.totalInventoryCount,
            cached: true,
            scannedAt: cached.scannedAt,
            expiresAt: cached.expiresAt,
            marketScanWarning: cached.marketScanWarning,
            storageUnits: requestHasCookie ? (cached.storageUnits ?? []) : [],
            ...(requestHasCookie
              ? {
                  walletBalance: cached.walletBalance,
                  walletBalanceVnd: cached.walletBalanceVnd,
                }
              : {}),
          },
        });
        return;
      }
    }

    // Step 2.5: Validate Cookie if provided
    let hasCookie = false;
    let cookieValue = '';
    let parentalCookie = '';
    let sessionidCookie = '';
    if (steamCookie && steamCookie.trim()) {
      updateScanJob(jobId, {
        percent: 20,
        message: 'checkingCookieConfig',
      });
      const parsed = parseSteamCookies(steamCookie);
      cookieValue = parsed.steamLoginSecure;
      parentalCookie = parsed.steamparental || '';
      sessionidCookie = parsed.sessionid || '';

      const cookieSteamId = extractSteamIdFromCookie(cookieValue);
      if (!cookieSteamId) {
        throw new Error('cookieInvalidFormat');
      }
      if (cookieSteamId !== steamId64) {
        throw new Error(
          `cookieSteamIdMismatch:cookieSteamId=${cookieSteamId},steamId64=${steamId64}`
        );
      }

      // Pre-flight check: make sure the cookie is actually alive
      let fullCookieHeader = `steamLoginSecure=${cookieValue}`;
      if (parentalCookie) {
        fullCookieHeader += `; steamparental=${parentalCookie}`;
      }
      if (sessionidCookie) {
        fullCookieHeader += `; sessionid=${sessionidCookie}`;
      }

      let validateRes: Response | null = null;
      try {
        validateRes = await fetchWithTimeout(
          'https://steamcommunity.com/my/inventory',
          {
            headers: {
              'User-Agent': USER_AGENTS.steamBrowser,
              Cookie: fullCookieHeader,
            },
            redirect: 'manual',
          },
          STEAM_COOKIE_VALIDATE_TIMEOUT_MS
        );
      } catch (err) {
        console.warn(
          '[InventoryScanner] Cookie preflight timed out/failed. Proceeding to actual fetch...',
          err
        );
      }

      if (validateRes) {
        if (validateRes.status === 302) {
          const location = validateRes.headers.get('location') || '';
          if (location.includes('/login/')) {
            if (ownerId) {
              const db = await getDatabase();
              await db.collection('portfolio_accounts').updateOne(
                { steamId64, ownerId },
                {
                  $set: {
                    steamCookie: '',
                    cookieError: 'cookieExpired',
                  },
                }
              );
            }
            throw new Error('cookieExpired');
          }
        } else if (validateRes.status === 403) {
          console.warn(
            `[InventoryScanner] /my/inventory returned 403 (Family View). Proceeding to actual fetch...`
          );
        }
      }

      hasCookie = true;
    }

    updateScanJob(jobId, {
      percent: 30,
      message: 'startingSteamScan',
    });

    const steamHeaders: Record<string, string> = {
      'User-Agent': USER_AGENTS.steamBrowser,
      Referer: `https://steamcommunity.com/profiles/${steamId64}/inventory/`,
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    if (hasCookie) {
      let fullCookieHeader = `steamLoginSecure=${cookieValue}`;
      if (parentalCookie) {
        fullCookieHeader += `; steamparental=${parentalCookie}`;
      }
      if (sessionidCookie) {
        fullCookieHeader += `; sessionid=${sessionidCookie}`;
      }
      steamHeaders['Cookie'] = fullCookieHeader;
    }

    const allAssets: Array<{
      classid: string;
      instanceid: string;
      amount: string;
      assetid: string;
      onMarket?: boolean;
    }> = [];
    const allDescriptions: Array<{
      classid: string;
      instanceid: string;
      name?: string;
      market_hash_name: string;
      marketable: number;
      type: string;
      icon_url?: string;
      tags?: Array<{
        category?: string;
        internal_name?: string;
        localized_tag_name?: string;
        color?: string;
      }>;
      owner_descriptions?: Array<{
        type: string;
        value: string;
        color?: string;
      }>;
      descriptions?: Array<{
        type: string;
        value: string;
        color?: string;
      }>;
      actions?: Array<{
        name?: string;
        link?: string;
      }>;
    }> = [];
    const allAssetProperties: Array<{
      appid?: number;
      contextid?: string;
      assetid: string;
      asset_properties?: Array<{
        propertyid: number;
        int_value?: string;
        float_value?: string;
        string_value?: string;
        name?: string;
      }>;
    }> = [];
    let totalInventoryCount = 0;
    const contexts = [2];
    if (hasCookie) {
      contexts.push(16);
    }

    for (const contextId of contexts) {
      let startAssetId: string | undefined;
      let contextTotalAdded = false;

      for (let page = 0; page < 20; page++) {
        updateScanJob(jobId, {
          percent: 30 + Math.min(page * 2, 20) + (contextId === 16 ? 10 : 0),
          message: 'loadingInventory',
          detail: { group: contextId, page: page + 1 },
        });

        let inventoryUrl = `https://steamcommunity.com/inventory/${steamId64}/730/${contextId}?l=english&count=2000`;
        if (startAssetId) {
          inventoryUrl += `&start_assetid=${startAssetId}`;
        }

        let response: Response;
        try {
          response = await fetchWithTimeout(
            inventoryUrl,
            { headers: steamHeaders },
            STEAM_INVENTORY_FETCH_TIMEOUT_MS
          );
        } catch (err) {
          if (contextId === 16) {
            console.error('Context 16 timed out/failed. Skipping trade-protected items.', err);
            break;
          }
          if (allAssets.length > 0) {
            console.error(
              'Inventory page timed out/failed after partial results. Continuing.',
              err
            );
            break;
          }
          throw err;
        }

        if (response.status === 403) {
          if (contextId === 16) {
            console.error('Context 16 returned 403 Forbidden. Skipping trade-protected items.');
            break;
          }
          if (hasCookie) {
            const fallbackHeaders = { ...steamHeaders };
            delete fallbackHeaders['Cookie'];
            const fallbackRes = await fetchWithTimeout(
              inventoryUrl,
              { headers: fallbackHeaders },
              STEAM_INVENTORY_FETCH_TIMEOUT_MS
            );

            if (ownerId) {
              const db = await getDatabase();
              await db.collection('portfolio_accounts').updateOne(
                { steamId64, ownerId },
                {
                  $set: {
                    steamCookie: '',
                    cookieError: fallbackRes.ok
                      ? 'familyViewCookieRequired'
                      : 'privateInventoryCookieRequired',
                  },
                }
              );
            }

            if (fallbackRes.ok) {
              const debugInfo = `[Debug: steamLoginSecure=${cookieValue ? 'present' : 'empty'}, steamparental=${parentalCookie ? 'present' : 'empty'}, sessionid=${sessionidCookie ? 'present' : 'empty'}]`;
              throw new Error(
                `familyViewInvalidParentalCookie:debugInfo=${encodeURIComponent(debugInfo)}`
              );
            } else {
              throw new Error('privateInventoryCookieRequired');
            }
          } else {
            throw new Error('privateInventoryNoCookie');
          }
        }

        if (!response.ok) {
          if (contextId === 16) {
            console.error(`Context 16 returned status ${response.status}. Skipping.`);
            break;
          }
          if (allAssets.length > 0) break;
          throw new Error(`steamHttpError:status=${response.status}`);
        }

        const data = await response.json();

        if (data.success === false || data.success === 0) {
          if (contextId === 16) {
            console.error(`Context 16 returned success = false. Skipping.`);
            break;
          }
          if (allAssets.length > 0) break;
          throw new Error(data.Error || 'privateInventoryOrNotFound');
        }

        if (data.assets) allAssets.push(...data.assets);
        if (data.descriptions) allDescriptions.push(...data.descriptions);
        if (data.asset_properties) allAssetProperties.push(...data.asset_properties);

        if (data.total_inventory_count && !contextTotalAdded) {
          totalInventoryCount += data.total_inventory_count;
          contextTotalAdded = true;
        }

        if (!data.more_items || !data.last_assetid) break;
        startAssetId = data.last_assetid;
      }
    }

    // Step 4.5: Scan items currently listed for sale on Steam Market
    const descriptionKeys = new Set(
      allDescriptions.map((desc) => `${desc.classid}_${desc.instanceid}`)
    );
    let marketScanWarning = !hasCookie;
    if (hasCookie) {
      try {
        let start = 0;
        const count = 100;
        let hasMoreListings = true;
        let success = true;
        let marketScanCount = allAssets.filter((a) => a.onMarket).length;

        while (hasMoreListings) {
          updateScanJob(jobId, {
            percent: 52,
            message: 'scanningMarketListings',
            detail: { count: marketScanCount },
          });

          const marketUrl = `https://steamcommunity.com/market/mylistings?norender=1&start=${start}&count=${count}`;
          const marketRes = await fetchWithTimeout(
            marketUrl,
            { headers: steamHeaders },
            STEAM_MARKET_LISTINGS_TIMEOUT_MS
          );
          if (!marketRes.ok) {
            console.error(`Steam Market listings error: HTTP ${marketRes.status}`);
            success = false;
            break;
          }

          const marketData = await marketRes.json();
          if (!marketData || marketData.success === false) {
            console.error('Steam Market listings success = false');
            success = false;
            break;
          }

          const listings = marketData.listings || [];
          const assets = marketData.assets || {};
          const cs2Assets = assets['730']?.['2'] || {};

          for (const listing of listings) {
            const asset = listing.asset;
            if (asset && asset.appid === 730) {
              const assetId = asset.id;
              const assetDetail = cs2Assets[assetId];

              if (assetDetail) {
                allAssets.push({
                  classid: assetDetail.classid,
                  instanceid: assetDetail.instanceid,
                  amount: asset.amount || '1',
                  assetid: assetId,
                  onMarket: true,
                });
                marketScanCount += 1;

                const key = `${assetDetail.classid}_${assetDetail.instanceid}`;
                if (!descriptionKeys.has(key)) {
                  allDescriptions.push({
                    classid: assetDetail.classid,
                    instanceid: assetDetail.instanceid,
                    name: assetDetail.name,
                    market_hash_name: assetDetail.market_hash_name || assetDetail.name,
                    marketable: 1,
                    type: assetDetail.type || '',
                    icon_url: assetDetail.icon_url,
                    tags: assetDetail.tags,
                  });
                  descriptionKeys.add(key);
                }
              }
            }
          }

          if (listings.length < count || start + listings.length >= marketData.total_count) {
            hasMoreListings = false;
          } else {
            start += listings.length;
          }
        }

        if (success) {
          marketScanWarning = false;
        } else {
          marketScanWarning = true;
        }
      } catch (err) {
        console.error('Failed to fetch market listings:', err);
        marketScanWarning = true;
      }
    }

    if (allAssets.length === 0) {
      throw new Error('emptyOrPrivateInventory');
    }

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
        itemType: 'Case' | 'Capsule' | 'Sticker' | 'Skin';
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

      const isStorageUnit = (() => {
        if (desc.market_hash_name === 'Storage Unit') return true;
        if (desc.type?.toLowerCase().includes('storage container')) return true;
        if (desc.market_hash_name?.toLowerCase().includes('storage container')) return true;

        const isTool =
          desc.type?.toLowerCase().includes('tool') ||
          desc.tags?.some(
            (t) => t.category === 'Type' && t.internal_name?.toLowerCase().includes('tool')
          );

        const hasStorageText =
          desc.descriptions?.some(
            (d) =>
              d.value?.toLowerCase().includes('storage unit') &&
              d.value?.toLowerCase().includes('1,000')
          ) ||
          desc.owner_descriptions?.some(
            (d) =>
              d.value?.toLowerCase().includes('storage unit') &&
              d.value?.toLowerCase().includes('1,000')
          );

        return Boolean(isTool && hasStorageText);
      })();

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

      const nameLower = desc.market_hash_name?.toLowerCase() || '';
      const typeLower = desc.type?.toLowerCase() || '';
      const isKey =
        nameLower.includes('key') &&
        (nameLower.includes('case') ||
          nameLower.includes('capsule') ||
          nameLower.includes('sticker') ||
          typeLower.includes('key'));

      if (!desc.marketable && !isSpecialState && !isKey) continue;

      let itemType: 'Case' | 'Capsule' | 'Sticker' | 'Skin' = 'Skin';
      if (nameLower.includes('capsule') || nameLower.includes('package')) {
        itemType = 'Capsule';
      } else if (nameLower.includes('sticker')) {
        itemType = 'Sticker';
      } else if (nameLower.includes('case') || typeLower.includes('container')) {
        itemType = 'Case';
      }

      let rarity: { name: string; color: string } | undefined;
      if (desc.tags) {
        const rarityTag = desc.tags.find((t) => t.category === 'Rarity');
        if (rarityTag && rarityTag.localized_tag_name) {
          rarity = {
            name: rarityTag.localized_tag_name,
            color: rarityTag.color ? `#${rarityTag.color}` : '#b0c3d9',
          };
        }
      }

      let dopplerPhase: string | undefined;
      if (desc.tags) {
        for (const tag of desc.tags) {
          const tagName = tag.localized_tag_name || '';
          const tagInternal = tag.internal_name || '';
          if (tagName.includes('Phase 1') || tagInternal.includes('phase1'))
            dopplerPhase = 'Phase 1';
          else if (tagName.includes('Phase 2') || tagInternal.includes('phase2'))
            dopplerPhase = 'Phase 2';
          else if (tagName.includes('Phase 3') || tagInternal.includes('phase3'))
            dopplerPhase = 'Phase 3';
          else if (tagName.includes('Phase 4') || tagInternal.includes('phase4'))
            dopplerPhase = 'Phase 4';
          else if (tagName.includes('Ruby') || tagInternal.includes('ruby')) dopplerPhase = 'Ruby';
          else if (tagName.includes('Sapphire') || tagInternal.includes('sapphire'))
            dopplerPhase = 'Sapphire';
          else if (tagName.includes('Emerald') || tagInternal.includes('emerald'))
            dopplerPhase = 'Emerald';
          else if (tagName.includes('Black Pearl') || tagInternal.includes('blackpearl'))
            dopplerPhase = 'Black Pearl';
          if (dopplerPhase) break;
        }
      }

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
    if (hasCookie) {
      try {
        let fullCookieHeader = `steamLoginSecure=${cookieValue}`;
        if (parentalCookie) {
          fullCookieHeader += `; steamparental=${parentalCookie}`;
        }
        if (sessionidCookie) {
          fullCookieHeader += `; sessionid=${sessionidCookie}`;
        }
        const walletResult = await fetchSteamWalletBalance(fullCookieHeader);
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
          err.message.includes('Family View'));
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
            result: {
              steamId64: expiredCache.steamId64,
              profile: expiredCache.profile,
              items: expiredCache.items,
              totalPrice: expiredCache.totalPrice,
              totalQuantity: expiredCache.totalQuantity,
              totalInventoryCount: expiredCache.totalInventoryCount,
              cached: true,
              scannedAt: expiredCache.scannedAt,
              expiresAt: expiredCache.expiresAt,
              marketScanWarning: expiredCache.marketScanWarning,
              storageUnits: requestHasCookie ? (expiredCache.storageUnits ?? []) : [],
              ...(requestHasCookie
                ? {
                    walletBalance: expiredCache.walletBalance,
                    walletBalanceVnd: expiredCache.walletBalanceVnd,
                  }
                : {}),
            },
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

function parseAccessoryDescriptions(descriptions: SteamDescription[]): {
  stickers: ParsedStickerDescription[];
  charms: ParsedStickerDescription[];
} {
  const stickers: ParsedStickerDescription[] = [];
  const charms: ParsedStickerDescription[] = [];

  for (const description of descriptions) {
    const html = description.value;
    const lowerHtml = html.toLowerCase();
    if (
      !lowerHtml.includes('sticker:') &&
      !lowerHtml.includes('charm:') &&
      !lowerHtml.includes('keychain:')
    ) {
      continue;
    }

    const parsedFromImages = parseAccessoryImages(html);
    stickers.push(...parsedFromImages.stickers);
    charms.push(...parsedFromImages.charms);

    if (parsedFromImages.stickers.length === 0) {
      stickers.push(...parseAccessoryText(html, 'sticker'));
    }
    if (parsedFromImages.charms.length === 0) {
      charms.push(...parseAccessoryText(html, 'charm'));
      charms.push(...parseAccessoryText(html, 'keychain'));
    }
  }

  return { stickers, charms };
}

function parseAccessoryImages(html: string): {
  stickers: ParsedStickerDescription[];
  charms: ParsedStickerDescription[];
} {
  const stickers: ParsedStickerDescription[] = [];
  const charms: ParsedStickerDescription[] = [];
  const imageTags = html.match(/<img\b[^>]*>/gi) ?? [];

  for (const imageTag of imageTags) {
    const attrs = parseHtmlAttributes(imageTag);
    const title = decodeHtmlEntities(attrs.title ?? '');
    const src = attrs.src ? normalizeSteamImageUrl(attrs.src) : undefined;
    const accessory = parseAccessoryTitle(title, src);
    if (!accessory) continue;

    if (isCharmLabel(accessory.label)) {
      charms.push(accessory.description);
    } else {
      stickers.push(accessory.description);
    }
  }

  return { stickers, charms };
}

function parseAccessoryText(
  html: string,
  label: 'sticker' | 'charm' | 'keychain'
): ParsedStickerDescription[] {
  const text = decodeHtmlEntities(stripHtml(html));
  const match = text.match(new RegExp(`${label}:\\s*(.+)`, 'i'));
  if (!match?.[1]) return [];

  return match[1]
    .split(/\s*,\s*/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => buildAccessoryDescription(label, name));
}

function parseAccessoryTitle(
  title: string,
  imageUrl?: string
): { label: string; description: ParsedStickerDescription } | null {
  const match = title.match(/^\s*(sticker|charm|keychain):\s*(.+)$/i);
  if (!match?.[2]) return null;
  const label = match[1].toLowerCase();
  return {
    label,
    description: buildAccessoryDescription(label, match[2].trim(), imageUrl),
  };
}

function buildAccessoryDescription(
  label: string,
  name: string,
  imageUrl?: string
): ParsedStickerDescription {
  const prefix = isCharmLabel(label) ? 'Charm' : 'Sticker';
  return {
    name,
    marketHashName: name.toLowerCase().startsWith(`${prefix.toLowerCase()} |`)
      ? name
      : `${prefix} | ${name}`,
    imageUrl,
  };
}

function parseHtmlAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(/\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)=(["'])(.*?)\2/g)) {
    attrs[match[1].toLowerCase()] = decodeHtmlEntities(match[3]);
  }
  return attrs;
}

function isCharmLabel(label: string): boolean {
  return label.toLowerCase() === 'charm' || label.toLowerCase() === 'keychain';
}

function enrichPatternInfoWithSteamStickerDescriptions(
  patternInfo: PatternInfo | undefined,
  stickerDescriptions: ParsedStickerDescription[],
  charmDescriptions: ParsedStickerDescription[]
): PatternInfo | undefined {
  if (!patternInfo || (stickerDescriptions.length === 0 && charmDescriptions.length === 0)) {
    return patternInfo;
  }
  const existing = patternInfo.stickers ?? [];
  const maxLength = Math.max(existing.length, stickerDescriptions.length);
  const stickers = Array.from({ length: maxLength }, (_, index) => {
    const current = existing[index];
    const parsed = stickerDescriptions[index];
    return {
      ...current,
      name: parsed?.name ?? current?.name ?? `Sticker ${index + 1}`,
      marketHashName: parsed?.marketHashName ?? current?.marketHashName,
      imageUrl: parsed?.imageUrl ?? current?.imageUrl,
      slot: current?.slot ?? index,
      wear: current?.wear ?? 0,
    };
  });
  const existingCharms = patternInfo.charms ?? [];
  const maxCharmLength = Math.max(existingCharms.length, charmDescriptions.length);
  const charms = Array.from({ length: maxCharmLength }, (_, index) => {
    const current = existingCharms[index];
    const parsed = charmDescriptions[index];
    return {
      ...current,
      name: parsed?.name ?? current?.name ?? `Charm ${index + 1}`,
      marketHashName: parsed?.marketHashName ?? current?.marketHashName,
      imageUrl: parsed?.imageUrl ?? current?.imageUrl,
      slot: current?.slot ?? index,
    };
  });
  return {
    ...patternInfo,
    stickers: stickers.length > 0 ? stickers : patternInfo.stickers,
    charms: charms.length > 0 ? charms : patternInfo.charms,
  };
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function getMarketHashNameLookupKey(value: string): string {
  const trimmed = value.trim();
  try {
    return decodeURIComponent(trimmed).trim().toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

function normalizeSteamImageUrl(url: string): string {
  const normalized = decodeHtmlEntities(url.trim());
  if (normalized.startsWith('//')) return `https:${normalized}`;
  if (normalized.startsWith('/economy/image/')) {
    return `https://community.cloudflare.steamstatic.com${normalized}`;
  }
  if (normalized.startsWith('http://')) {
    return normalized.replace(/^http:\/\//i, 'https://');
  }
  return normalized;
}
