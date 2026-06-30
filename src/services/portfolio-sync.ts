import type {
  PortfolioSourceAccount,
  CreatePortfolioItemInput,
} from "@/domain/portfolio-item";

export type {
  PortfolioSourceAccount,
  CreatePortfolioItemInput,
};
import { isRecord } from "@/utils/type-guards";
import { calculateTradeHoldUntil } from "@/utils/date";
import type { Db } from "mongodb";
import crypto from "node:crypto";
import type { PatternInfo } from "@/domain/pattern-info";
import {
  buildItemIdentityKey,
  buildItemVariantKey,
  type ItemIdentityInput,
} from "@/utils/item-identity";
export { isRecord } from "@/utils/type-guards";

const DEFAULT_ACCESSORY_PRICE_RATE = 0;
export const SCANNER_IMPORT_NOTE = "Import từ inventory scanner";
export const SCANNER_MANUAL_NOTE = "Thủ công từ inventory scanner";
export const LEGACY_SCANNER_IMPORT_NOTE = "Import tá»« inventory scanner";
export const SCANNER_IMPORT_NOTES = [
  SCANNER_IMPORT_NOTE,
  LEGACY_SCANNER_IMPORT_NOTE,
] as const;
export const SCANNER_PORTFOLIO_NOTES = [
  SCANNER_IMPORT_NOTE,
  SCANNER_MANUAL_NOTE,
  LEGACY_SCANNER_IMPORT_NOTE,
] as const;

export interface ExistingPortfolioItem {
  caseId: string;
  quantity: number;
  buyPrice: number;
  buyDate: Date;
  isTemporaryPrice?: boolean;
  note?: string;
  sourceAccounts?: PortfolioSourceAccount[];
  tradeHoldUntil?: Date;
  dopplerPhase?: string;
  inspectLink?: string;
  patternInfo?: any;
  stickerPriceRate?: number;
  stickerBuyPriceRate?: number;
  stickerBuyPriceAdd?: number;
  stickerScanTotalPrice?: number;
  stickerScanPriceCapturedAt?: Date;
}


export function normalizeHexColor(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? `#${normalized}` : undefined;
}

export function normalizeRarity(
  value: unknown,
): { name: string; color: string } | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const name =
    typeof value.name === "string" && value.name.trim()
      ? value.name.trim()
      : undefined;
  const color = normalizeHexColor(value.color);
  return name && color ? { name, color } : undefined;
}

export function mergeSourceAccounts(
  first: PortfolioSourceAccount[],
  second: PortfolioSourceAccount[],
): PortfolioSourceAccount[] {
  const map = new Map<string, PortfolioSourceAccount>();
  for (const account of [...first, ...second]) {
    const existing = map.get(account.steamId64);
    if (existing) {
      const mergedBreakdown =
        existing.breakdown || account.breakdown
          ? {
              tradeable:
                (existing.breakdown?.tradeable ?? 0) +
                (account.breakdown?.tradeable ?? 0),
              onMarket:
                (existing.breakdown?.onMarket ?? 0) +
                (account.breakdown?.onMarket ?? 0),
              tradeProtected:
                (existing.breakdown?.tradeProtected ?? 0) +
                (account.breakdown?.tradeProtected ?? 0),
              hold:
                (existing.breakdown?.hold ?? 0) +
                (account.breakdown?.hold ?? 0),
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
  newScan: PortfolioSourceAccount[],
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
      options?: { preferFallback?: boolean },
    ) => Promise<{ price: number } | null>;
  },
  capturedAt = new Date(),
): Promise<
  Pick<
    CreatePortfolioItemInput,
    | "stickerPriceRate"
    | "stickerBuyPriceRate"
    | "stickerBuyPriceAdd"
    | "stickerScanTotalPrice"
    | "stickerScanPriceCapturedAt"
  >
> {
  const info = isRecord(patternInfo) ? (patternInfo as PatternInfo) : undefined;
  const accessories = [
    ...(Array.isArray(info?.stickers) ? info.stickers : []),
    ...(Array.isArray(info?.charms) ? info.charms : []),
  ];
  const marketHashNames = accessories
    .map((accessory) => accessory.marketHashName)
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    );

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
    }),
  );
  const priceMap = new Map(entries);
  const total = marketHashNames.reduce(
    (sum, marketHashName) => sum + (priceMap.get(marketHashName) ?? 0),
    0,
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

interface AccountBreakdownPool {
  steamId64: string;
  name: string;
  tradeable: number;
  onMarket: number;
  tradeProtected: number;
  hold: number;
  holdDetails: Array<{ quantity: number; holdDays: number; tradeHoldUntil?: string | Date }>;
}

export function resolveSyncTransactions(
  caseId: string,
  totalScannedQty: number,
  currentPrice: number,
  sourceAccounts: PortfolioSourceAccount[],
  holdDays: number,
  existingItems: ExistingPortfolioItem[],
  buyDate: Date,
  note: string,
  tradeHoldUntilParam?: Date,
  dopplerPhase?: string,
  inspectLink?: string,
  patternInfo?: any,
  stickerFields?: Pick<
    CreatePortfolioItemInput,
    | "stickerPriceRate"
    | "stickerBuyPriceRate"
    | "stickerScanTotalPrice"
    | "stickerScanPriceCapturedAt"
  >,
): CreatePortfolioItemInput[] {
  const scannedVariantKey = buildItemVariantKey({
    caseId,
    dopplerPhase,
    inspectLink,
    patternInfo,
  });
  const existingForCase = existingItems
    .filter(
      (item) =>
        String(item.caseId) === caseId &&
        buildItemVariantKey({
          caseId: String(item.caseId),
          dopplerPhase: item.dopplerPhase,
          inspectLink: item.inspectLink,
          patternInfo: item.patternInfo,
        }) === scannedVariantKey,
    )
    .sort(
      (a, b) => new Date(a.buyDate).getTime() - new Date(b.buyDate).getTime(),
    );

  const totalExistingQty = existingForCase.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0,
  );
  const tradeHoldUntil =
    tradeHoldUntilParam ?? (
      holdDays > 0
        ? calculateTradeHoldUntil(buyDate, holdDays)
        : undefined
    );

  // Initialize pool of available account quantities to distribute accurately
  const pool: AccountBreakdownPool[] = sourceAccounts.map((sa) => ({
    steamId64: sa.steamId64,
    name: sa.name,
    tradeable: sa.breakdown?.tradeable ?? 0,
    onMarket: sa.breakdown?.onMarket ?? 0,
    tradeProtected: sa.breakdown?.tradeProtected ?? 0,
    hold: sa.breakdown?.hold ?? 0,
    holdDetails: sa.breakdown?.holdDetails ? [...sa.breakdown.holdDetails] : [],
  }));

  const allocateSourceAccounts = (targetQty: number): PortfolioSourceAccount[] => {
    const allocated: PortfolioSourceAccount[] = [];
    let remainingToAllocate = targetQty;

    for (const entry of pool) {
      if (remainingToAllocate <= 0) break;

      const entryTotal = entry.tradeable + entry.onMarket + entry.tradeProtected + entry.hold;
      if (entryTotal <= 0) continue;

      const takeTotal = Math.min(entryTotal, remainingToAllocate);
      let remainingToTakeFromEntry = takeTotal;

      const breakdown = {
        tradeable: 0,
        onMarket: 0,
        tradeProtected: 0,
        hold: 0,
        holdDetails: [] as Array<{ quantity: number; holdDays: number }>,
      };

      // Take from tradeable
      if (entry.tradeable > 0 && remainingToTakeFromEntry > 0) {
        const take = Math.min(entry.tradeable, remainingToTakeFromEntry);
        breakdown.tradeable = take;
        entry.tradeable -= take;
        remainingToTakeFromEntry -= take;
      }

      // Take from onMarket
      if (entry.onMarket > 0 && remainingToTakeFromEntry > 0) {
        const take = Math.min(entry.onMarket, remainingToTakeFromEntry);
        breakdown.onMarket = take;
        entry.onMarket -= take;
        remainingToTakeFromEntry -= take;
      }

      // Take from tradeProtected
      if (entry.tradeProtected > 0 && remainingToTakeFromEntry > 0) {
        const take = Math.min(entry.tradeProtected, remainingToTakeFromEntry);
        breakdown.tradeProtected = take;
        entry.tradeProtected -= take;
        remainingToTakeFromEntry -= take;
      }

      // Take from hold
      if (entry.hold > 0 && remainingToTakeFromEntry > 0) {
        const take = Math.min(entry.hold, remainingToTakeFromEntry);
        breakdown.hold = take;
        entry.hold -= take;
        remainingToTakeFromEntry -= take;

        // Also take from holdDetails
        let holdRemainingToTake = take;
        const newHoldDetails = [];
        for (const hd of entry.holdDetails) {
          if (holdRemainingToTake <= 0) break;
          if (hd.quantity > 0) {
            const hdTake = Math.min(hd.quantity, holdRemainingToTake);
            newHoldDetails.push({
              quantity: hdTake,
              holdDays: hd.holdDays,
              tradeHoldUntil: hd.tradeHoldUntil,
            });
            hd.quantity -= hdTake;
            holdRemainingToTake -= hdTake;
          }
        }
        breakdown.holdDetails = newHoldDetails;
      }

      allocated.push({
        steamId64: entry.steamId64,
        name: entry.name,
        breakdown,
      });

      remainingToAllocate -= takeTotal;
    }

    return allocated;
  };

  if (totalExistingQty === 0) {
    return [
      {
        caseId,
        quantity: totalScannedQty,
        buyPrice: currentPrice,
        buyDate,
        isTemporaryPrice: true,
        tradeHoldUntil,
        sourceAccounts: allocateSourceAccounts(totalScannedQty),
        note,
        dopplerPhase,
        inspectLink,
        patternInfo,
        ...stickerFields,
      },
    ];
  }

  if (totalScannedQty === totalExistingQty) {
    return existingForCase.map((item) => ({
      caseId,
      quantity: Number(item.quantity),
      buyPrice: Number(item.buyPrice),
      buyDate: new Date(item.buyDate),
      isTemporaryPrice: item.isTemporaryPrice,
      tradeHoldUntil,
      sourceAccounts: allocateSourceAccounts(Number(item.quantity)),
      note: item.note || note,
      dopplerPhase,
      inspectLink,
      patternInfo,
      stickerPriceRate: item.stickerPriceRate ?? stickerFields?.stickerPriceRate,
      stickerBuyPriceRate:
        item.stickerBuyPriceRate ?? stickerFields?.stickerBuyPriceRate,
      stickerScanTotalPrice:
        item.stickerScanTotalPrice ?? stickerFields?.stickerScanTotalPrice,
      stickerScanPriceCapturedAt:
        item.stickerScanPriceCapturedAt ??
        stickerFields?.stickerScanPriceCapturedAt,
    }));
  }

  if (totalScannedQty > totalExistingQty) {
    const resolved: CreatePortfolioItemInput[] = existingForCase.map((item) => ({
      caseId,
      quantity: Number(item.quantity),
      buyPrice: Number(item.buyPrice),
      buyDate: new Date(item.buyDate),
      isTemporaryPrice: item.isTemporaryPrice,
      tradeHoldUntil,
      sourceAccounts: allocateSourceAccounts(Number(item.quantity)),
      note: item.note || note,
      dopplerPhase,
      inspectLink,
      patternInfo,
      stickerPriceRate: item.stickerPriceRate ?? stickerFields?.stickerPriceRate,
      stickerBuyPriceRate:
        item.stickerBuyPriceRate ?? stickerFields?.stickerBuyPriceRate,
      stickerScanTotalPrice:
        item.stickerScanTotalPrice ?? stickerFields?.stickerScanTotalPrice,
      stickerScanPriceCapturedAt:
        item.stickerScanPriceCapturedAt ??
        stickerFields?.stickerScanPriceCapturedAt,
    }));

    resolved.push({
      caseId,
      quantity: totalScannedQty - totalExistingQty,
      buyPrice: currentPrice,
      buyDate,
      isTemporaryPrice: true,
      tradeHoldUntil,
      sourceAccounts: allocateSourceAccounts(totalScannedQty - totalExistingQty),
      note,
      dopplerPhase,
      inspectLink,
      patternInfo,
      ...stickerFields,
    });
    return resolved;
  }

  // LIFO deduction
  const resolved: CreatePortfolioItemInput[] = [];
  let remainingToKeep = totalScannedQty;

  for (const item of existingForCase) {
    if (remainingToKeep <= 0) break;
    const qty = Number(item.quantity);
    if (qty <= remainingToKeep) {
      resolved.push({
        caseId,
        quantity: qty,
        buyPrice: Number(item.buyPrice),
        buyDate: new Date(item.buyDate),
        isTemporaryPrice: item.isTemporaryPrice,
        tradeHoldUntil,
        sourceAccounts: allocateSourceAccounts(qty),
        note: item.note || note,
        dopplerPhase,
        inspectLink,
        patternInfo,
        stickerPriceRate:
          item.stickerPriceRate ?? stickerFields?.stickerPriceRate,
        stickerBuyPriceRate:
          item.stickerBuyPriceRate ?? stickerFields?.stickerBuyPriceRate,
        stickerScanTotalPrice:
          item.stickerScanTotalPrice ?? stickerFields?.stickerScanTotalPrice,
        stickerScanPriceCapturedAt:
          item.stickerScanPriceCapturedAt ??
          stickerFields?.stickerScanPriceCapturedAt,
      });
      remainingToKeep -= qty;
    } else {
      resolved.push({
        caseId,
        quantity: remainingToKeep,
        buyPrice: Number(item.buyPrice),
        buyDate: new Date(item.buyDate),
        isTemporaryPrice: item.isTemporaryPrice,
        tradeHoldUntil,
        sourceAccounts: allocateSourceAccounts(remainingToKeep),
        note: item.note || note,
        dopplerPhase,
        inspectLink,
        patternInfo,
        stickerPriceRate:
          item.stickerPriceRate ?? stickerFields?.stickerPriceRate,
        stickerBuyPriceRate:
          item.stickerBuyPriceRate ?? stickerFields?.stickerBuyPriceRate,
        stickerScanTotalPrice:
          item.stickerScanTotalPrice ?? stickerFields?.stickerScanTotalPrice,
        stickerScanPriceCapturedAt:
          item.stickerScanPriceCapturedAt ??
          stickerFields?.stickerScanPriceCapturedAt,
      });
      remainingToKeep = 0;
    }
  }

  return resolved;
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
  patternInfo?: any;
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
  patternInfo?: any;
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
  sourceAccounts?: ItemIdentityInput["sourceAccounts"];
  holdDays?: number;
  tradeHoldUntil?: string | Date;
  onMarket?: boolean;
  tradeProtected?: boolean;
}): string {
  return buildItemIdentityKey(input);
}

export type SyncProgressEvent = {
  type:
    | "account_start"
    | "account_progress"
    | "account_done"
    | "account_error"
    | "import_start"
    | "import_done"
    | "complete"
    | "error";
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
    patternInfo?: any;
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
  const accountName = String(account.name || "Unknown");
  const steamId64 = String(account.steamId64);

  if (scanResult.items && Array.isArray(scanResult.items)) {
    for (const item of scanResult.items) {
      const quantity = Number(item.quantity);
      const holdDays = typeof item.holdDays === "number" && item.holdDays > 0 ? item.holdDays : 0;
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
          id: String(item.caseItem?.id || ""),
          name: String(item.caseItem?.name || ""),
          marketHashName: String(item.caseItem?.marketHashName || ""),
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
        assetId: String(su.assetId || ""),
        name: String(su.name || "Storage Unit"),
        iconUrl: su.iconUrl ? String(su.iconUrl) : null,
      });
    }
  }
}

export async function pollJobProgress(
  origin: string,
  jobId: string,
  onProgress: (progress: {
    stage: string;
    message: string;
    percent: number;
    detail?: Record<string, number | string>;
  }) => void
): Promise<Record<string, unknown>> {
  const TIMEOUT_MS = 5 * 60 * 1000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < TIMEOUT_MS) {
    const res = await fetch(`${origin}/api/inventory/scan?jobId=${encodeURIComponent(jobId)}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error("cannotReadScanProgress");
    }

    const progress = await res.json();

    onProgress({
      stage: progress.stage ?? "running",
      message: progress.message ?? "scanning",
      percent: progress.percent ?? 0,
      detail: progress.detail,
    });

    if (progress.status === "done") {
      return (progress.result ?? {}) as Record<string, unknown>;
    }

    if (progress.status === "error") {
      throw new Error(progress.error ?? progress.message ?? "scanFailed");
    }

    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  throw new Error("scanTimeout");
}

export async function startInventoryScanJob(input: {
  steamUrl: string;
  steamCookie?: string;
  forceRefresh?: boolean;
  ownerId: string;
}): Promise<string> {
  const [{ createScanJob }, { runScanJob }] = await Promise.all([
    import("@/services/scan-job-store"),
    import("@/services/scan-service"),
  ]);
  const jobId = crypto.randomUUID();
  await createScanJob(jobId, {
    id: jobId,
    ownerId: input.ownerId,
    status: "queued",
    percent: 0,
    message: "waitingScan",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  void runScanJob(jobId, input);
  return jobId;
}

export async function createImportedCase(
  db: Db,
  input: {
    name: string;
    marketHashName: string;
    imageUrl?: string;
    rarity?: { name: string; color: string };
  }
) {
  const now = new Date();
  const collection = db.collection("cases");
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
  return doc
    ? {
        id: doc._id.toString(),
        name: doc.name,
        marketHashName: doc.marketHashName,
        imageUrl: doc.imageUrl,
      }
    : null;
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

  await db.collection("cases").updateOne({ marketHashName: input.marketHashName }, { $set });
}
