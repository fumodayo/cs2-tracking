import type { PortfolioSourceAccount, CreatePortfolioItemInput } from '@/domain/portfolio-item';

export type { PortfolioSourceAccount, CreatePortfolioItemInput };
import { isRecord } from '@/utils/type-guards';
import type { Db } from 'mongodb';
import type { PatternInfo } from '@/domain/pattern-info';
import type { CaseItem } from '@/domain/case-item';
import { mapCaseDocument } from '@/infrastructure/db/mappers';
import { buildItemIdentityKey, type ItemIdentityInput } from '@/utils/item-identity';
export { isRecord } from '@/utils/type-guards';
export { pollJobProgress, startInventoryScanJob } from '@/services/scan-job-client';
export {
  resolveSyncTransactions,
  type ExistingPortfolioItem,
} from '@/services/portfolio-sync-transactions';

const DEFAULT_ACCESSORY_PRICE_RATE = 0;
export const SCANNER_IMPORT_NOTE = 'Import từ inventory scanner';
export const SCANNER_MANUAL_NOTE = 'Thủ công từ inventory scanner';
export const LEGACY_SCANNER_IMPORT_NOTE = 'Import tá»« inventory scanner';
export const SCANNER_IMPORT_NOTES = [SCANNER_IMPORT_NOTE, LEGACY_SCANNER_IMPORT_NOTE] as const;
export const SCANNER_PORTFOLIO_NOTES = [
  SCANNER_IMPORT_NOTE,
  SCANNER_MANUAL_NOTE,
  LEGACY_SCANNER_IMPORT_NOTE,
] as const;

export function normalizeHexColor(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().replace(/^#/, '');
  return /^[0-9a-f]{6}$/i.test(normalized) ? `#${normalized}` : undefined;
}

export function normalizeRarity(value: unknown): { name: string; color: string } | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : undefined;
  const color = normalizeHexColor(value.color);
  return name && color ? { name, color } : undefined;
}

export function mergeSourceAccounts(
  first: PortfolioSourceAccount[],
  second: PortfolioSourceAccount[]
): PortfolioSourceAccount[] {
  const map = new Map<string, PortfolioSourceAccount>();
  for (const account of [...first, ...second]) {
    const existing = map.get(account.steamId64);
    if (existing) {
      const mergedBreakdown =
        existing.breakdown || account.breakdown
          ? {
              tradeable: (existing.breakdown?.tradeable ?? 0) + (account.breakdown?.tradeable ?? 0),
              onMarket: (existing.breakdown?.onMarket ?? 0) + (account.breakdown?.onMarket ?? 0),
              tradeProtected:
                (existing.breakdown?.tradeProtected ?? 0) +
                (account.breakdown?.tradeProtected ?? 0),
              hold: (existing.breakdown?.hold ?? 0) + (account.breakdown?.hold ?? 0),
              holdDetails: [
                ...(existing.breakdown?.holdDetails ?? []),
                ...(account.breakdown?.holdDetails ?? []),
              ],
            }
          : undefined;
      map.set(account.steamId64, {
        ...existing,
        breakdown: mergedBreakdown,
      });
    } else {
      map.set(account.steamId64, account);
    }
  }
  return Array.from(map.values());
}

export function updateSourceAccounts(
  existing: PortfolioSourceAccount[],
  newScan: PortfolioSourceAccount[]
): PortfolioSourceAccount[] {
  const map = new Map<string, PortfolioSourceAccount>();
  for (const acc of existing) {
    map.set(acc.steamId64, acc);
  }
  for (const acc of newScan) {
    map.set(acc.steamId64, acc);
  }
  return Array.from(map.values());
}

export function getImportableScanPrice(value: unknown): number {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

export async function buildAccessoryPriceFields(
  patternInfo: unknown,
  priceService: {
    getCurrentPrice: (
      item: {
        id: string;
        name: string;
        marketHashName: string;
        isActive: boolean;
      },
      options?: { preferFallback?: boolean }
    ) => Promise<{ price: number } | null>;
  },
  capturedAt = new Date()
): Promise<
  Pick<
    CreatePortfolioItemInput,
    | 'stickerPriceRate'
    | 'stickerBuyPriceRate'
    | 'stickerBuyPriceAdd'
    | 'stickerScanTotalPrice'
    | 'stickerScanPriceCapturedAt'
  >
> {
  const info = isRecord(patternInfo) ? (patternInfo as PatternInfo) : undefined;
  const accessories = [
    ...(Array.isArray(info?.stickers) ? info.stickers : []),
    ...(Array.isArray(info?.charms) ? info.charms : []),
  ];
  const marketHashNames = accessories
    .map((accessory) => accessory.marketHashName)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  if (marketHashNames.length === 0) {
    return {};
  }

  const uniqueNames = Array.from(new Set(marketHashNames));
  const entries = await Promise.all(
    uniqueNames.map(async (marketHashName) => {
      const item = {
        id: `ext_${marketHashName}`,
        name: marketHashName,
        marketHashName,
        isActive: false,
      };
      try {
        const snapshot = await priceService.getCurrentPrice(item, {
          preferFallback: true,
        });
        return [marketHashName, snapshot?.price ?? 0] as const;
      } catch {
        return [marketHashName, 0] as const;
      }
    })
  );
  const priceMap = new Map(entries);
  const total = marketHashNames.reduce(
    (sum, marketHashName) => sum + (priceMap.get(marketHashName) ?? 0),
    0
  );

  if (total <= 0) {
    return {};
  }

  return {
    stickerPriceRate: DEFAULT_ACCESSORY_PRICE_RATE,
    stickerBuyPriceRate: DEFAULT_ACCESSORY_PRICE_RATE,
    stickerBuyPriceAdd: Math.round((total * DEFAULT_ACCESSORY_PRICE_RATE) / 100),
    stickerScanTotalPrice: total,
    stickerScanPriceCapturedAt: capturedAt,
  };
}

export type SyncScannedItem = {
  caseItem: {
    id: string;
    name: string;
    marketHashName: string;
    imageUrl: string | null;
  };
  rarity?: {
    name: string;
    color: string;
  };
  quantity: number;
  price: number;
  sourceAccounts: PortfolioSourceAccount[];
  holdDays?: number;
  tradeHoldUntil?: string;
  onMarket?: boolean;
  tradeProtected?: boolean;
  dopplerPhase?: string;
  inspectLink?: string;
  patternInfo?: PatternInfo;
  stickerPriceRate?: number;
  stickerBuyPriceRate?: number;
  stickerBuyPriceAdd?: number;
  stickerScanTotalPrice?: number;
  stickerScanPriceCapturedAt?: Date;
};

export type GroupedInput = {
  caseId: string;
  quantity: number;
  buyPrice: number;
  note: string;
  sourceAccounts: PortfolioSourceAccount[];
  holdDays: number;
  tradeHoldUntil?: string;
  dopplerPhase?: string;
  inspectLink?: string;
  patternInfo?: PatternInfo;
  stickerPriceRate?: number;
  stickerBuyPriceRate?: number;
  stickerBuyPriceAdd?: number;
  stickerScanTotalPrice?: number;
  stickerScanPriceCapturedAt?: Date;
};

export function buildSyncGroupKey(input: {
  caseId: string;
  dopplerPhase?: string;
  inspectLink?: string;
  patternInfo?: unknown;
  sourceAccounts?: ItemIdentityInput['sourceAccounts'];
  holdDays?: number;
  tradeHoldUntil?: string | Date;
  onMarket?: boolean;
  tradeProtected?: boolean;
}): string {
  return buildItemIdentityKey(input);
}

export type SyncProgressEvent = {
  type:
    | 'account_start'
    | 'account_progress'
    | 'account_done'
    | 'account_error'
    | 'import_start'
    | 'import_done'
    | 'complete'
    | 'error';
  accountIndex?: number;
  totalAccounts?: number;
  accountName?: string;
  steamId64?: string;
  avatarUrl?: string | null;
  message: string;
  percent: number;
  scanProgress?: {
    stage: string;
    message: string;
    percent: number;
    detail?: Record<string, number | string>;
  };
  summary?: {
    scannedAccountsCount: number;
    totalAccountsCount: number;
    importedCount: number;
    skippedAccounts: string[];
    missingItems?: MissingItem[];
    extraItems?: ExtraItem[];
    storageUnits?: SyncStorageUnit[];
  };
};

export type AccountChangeDetail = {
  steamId64: string;
  name: string;
  change: number;
  previousQuantity: number;
  currentQuantity: number;
};

export type MissingItem = {
  caseId: string;
  marketHashName: string;
  caseName: string;
  imageUrl: string | null;
  previousQuantity: number;
  currentQuantity: number;
  missingQuantity: number;
  accounts?: AccountChangeDetail[];
};

export type ExtraItem = {
  caseId: string;
  marketHashName: string;
  caseName: string;
  imageUrl: string | null;
  previousQuantity: number;
  currentQuantity: number;
  extraQuantity: number;
  accounts?: AccountChangeDetail[];
  breakdown?: {
    tradeable: number;
    onMarket: number;
    tradeProtected: number;
    hold: number;
  };
};

export { buildSyncChangeSummary, getSyncAccountChanges } from '@/services/portfolio-sync-changes';

export type SyncStorageUnit = {
  id: string;
  name: string;
  steamId64: string;
  currentCount: number;
};

export type ScanResult = {
  items?: Array<{
    quantity?: number | string;
    holdDays?: number;
    tradeHoldUntil?: string;
    onMarket?: boolean;
    tradeProtected?: boolean;
    price?: number | string;
    rarity?: unknown;
    caseItem?: {
      id?: string;
      name?: string;
      marketHashName?: string;
      imageUrl?: string | null;
    };
    dopplerPhase?: string;
    inspectLink?: string;
    patternInfo?: PatternInfo;
  }>;
  storageUnits?: Array<{
    assetId?: string;
    name?: string;
    iconUrl?: string | null;
  }>;
};

export function processScanResult(
  scanResult: ScanResult,
  account: { name?: string; steamId64: string | number },
  allScannedItems: SyncScannedItem[],
  allScannedStorageUnits: Array<{
    steamId64: string;
    assetId: string;
    name: string;
    iconUrl: string | null;
  }>
) {
  const accountName = String(account.name || 'Unknown');
  const steamId64 = String(account.steamId64);

  if (scanResult.items && Array.isArray(scanResult.items)) {
    for (const item of scanResult.items) {
      const quantity = Number(item.quantity);
      const holdDays = typeof item.holdDays === 'number' && item.holdDays > 0 ? item.holdDays : 0;
      const onMarket = item.onMarket === true;
      const tradeProtected = item.tradeProtected === true;

      const itemSourceAccount: PortfolioSourceAccount = {
        steamId64,
        name: accountName,
        breakdown: {
          tradeable: !holdDays && !onMarket && !tradeProtected ? quantity : 0,
          onMarket: onMarket ? quantity : 0,
          tradeProtected: tradeProtected ? quantity : 0,
          hold: holdDays > 0 ? quantity : 0,
          holdDetails:
            holdDays > 0 ? [{ quantity, holdDays, tradeHoldUntil: item.tradeHoldUntil }] : [],
        },
      };

      allScannedItems.push({
        caseItem: {
          id: String(item.caseItem?.id || ''),
          name: String(item.caseItem?.name || ''),
          marketHashName: String(item.caseItem?.marketHashName || ''),
          imageUrl: item.caseItem?.imageUrl ? String(item.caseItem.imageUrl) : null,
        },
        rarity: normalizeRarity(item.rarity),
        quantity,
        price: Number(item.price),
        sourceAccounts: [itemSourceAccount],
        holdDays: holdDays > 0 ? holdDays : undefined,
        tradeHoldUntil: holdDays > 0 ? item.tradeHoldUntil : undefined,
        onMarket: onMarket || undefined,
        tradeProtected: tradeProtected || undefined,
        dopplerPhase: item.dopplerPhase,
        inspectLink: item.inspectLink,
        patternInfo: item.patternInfo,
      });
    }
  }

  if (scanResult.storageUnits && Array.isArray(scanResult.storageUnits)) {
    for (const su of scanResult.storageUnits) {
      allScannedStorageUnits.push({
        steamId64,
        assetId: String(su.assetId || ''),
        name: String(su.name || 'Storage Unit'),
        iconUrl: su.iconUrl ? String(su.iconUrl) : null,
      });
    }
  }
}

export async function createImportedCase(
  db: Db,
  input: {
    name: string;
    marketHashName: string;
    imageUrl?: string;
    rarity?: { name: string; color: string };
  }
): Promise<CaseItem | null> {
  const now = new Date();
  const collection = db.collection('cases');
  await collection.updateOne(
    { marketHashName: input.marketHashName },
    {
      $set: {
        name: input.name,
        marketHashName: input.marketHashName,
        imageUrl: input.imageUrl,
        ...(input.rarity ? { rarity: input.rarity } : {}),
        isActive: true,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );
  const doc = await collection.findOne({
    marketHashName: input.marketHashName,
  });
  return doc ? mapCaseDocument(doc) : null;
}

export async function updateImportedCaseMetadata(
  db: Db,
  input: {
    marketHashName: string;
    imageUrl?: string;
    rarity?: { name: string; color: string };
  }
) {
  const $set: Record<string, unknown> = { updatedAt: new Date() };
  if (input.imageUrl) {
    $set.imageUrl = input.imageUrl;
  }
  if (input.rarity) {
    $set.rarity = input.rarity;
  }

  await db.collection('cases').updateOne({ marketHashName: input.marketHashName }, { $set });
}
