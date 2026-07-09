import type { StorageUnitInfo } from '@/domain/storage-unit';
import type { PatternInfo } from '@/domain/pattern-info';
import { updateScanJob } from '@/services/scan-job-store';
import { analyzeItemStatus } from '@/services/scan-steam-fetcher';
import type {
  SteamAssetProperties,
  SteamInventoryAsset,
  SteamInventoryDescription,
} from '@/services/scan-steam-inventory';
import { decodeInspectLink } from '@/services/pattern/inspect-link-decoder';
import { analyzePattern } from '@/services/pattern/pattern-analyzer';
import { buildInspectLink } from '@/services/pattern/inspect-link-builder';
import {
  STEAM_IMAGE_CDN,
  enrichPatternInfoWithSteamStickerDescriptions,
  parseAccessoryDescriptions,
} from '@/services/scan-accessories';
import {
  getDopplerPhaseFromDescription,
  getRarityFromDescription,
  isStorageUnitDescription,
  shouldIncludeSteamDescription,
} from '@/services/scan-item-metadata';
import { inferInventoryItemType, type Cs2InventoryItemType } from '@/utils/cs2-item-type';

export type AnalyzedScanItemGroup = {
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
};

type AnalyzeSteamInventoryItemsParams = {
  jobId: string;
  steamId64: string;
  assets: SteamInventoryAsset[];
  descriptions: SteamInventoryDescription[];
  assetProperties: SteamAssetProperties[];
};

// Chuyển payload inventory Steam thô thành các dòng CS2 đã gom nhóm, sẵn sàng định giá.
// Skin được giữ theo từng asset vì inspect link, float, sticker và charm có thể khác nhau.
export async function analyzeSteamInventoryItems({
  jobId,
  steamId64,
  assets,
  descriptions,
  assetProperties,
}: AnalyzeSteamInventoryItemsParams): Promise<{
  cs2Items: Record<string, AnalyzedScanItemGroup>;
  storageUnits: StorageUnitInfo[];
}> {
  const itemCounts: Record<string, { count: number; onMarket: boolean }> = {};
  const assetsByDescKey = new Map<string, SteamInventoryAsset[]>();
  const assetsByDescStatusKey = new Map<string, SteamInventoryAsset[]>();

  // Tạo bảng tra cứu một lần để lượt xử lý description phía sau không phải quét asset lặp lại.
  for (const [assetIndex, asset] of assets.entries()) {
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
        detail: { count: assetIndex + 1, total: assets.length },
      });
    }
  }

  const descMap = new Map<string, SteamInventoryDescription>();
  for (const desc of descriptions) {
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
  for (const ap of assetProperties) {
    if (ap.assetid && ap.asset_properties) {
      assetPropertiesMap.set(ap.assetid, ap.asset_properties);
    }
  }

  const cs2Items: Record<string, AnalyzedScanItemGroup> = {};
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
      // Key gồm trạng thái trade và định danh asset để dòng market/hold/protected vẫn tách biệt.
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

  return { cs2Items, storageUnits };
}
