import type {
  PortfolioSourceAccount,
  CreatePortfolioItemInput,
} from "@/domain/portfolio-item";
import { isRecord } from "@/utils/type-guards";
export { isRecord } from "@/utils/type-guards";

export interface ExistingPortfolioItem {
  caseId: string;
  quantity: number;
  buyPrice: number;
  buyDate: Date;
  isTemporaryPrice?: boolean;
  note?: string;
  sourceAccounts?: PortfolioSourceAccount[];
  tradeHoldUntil?: Date;
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

export function resolveSyncTransactions(
  caseId: string,
  totalScannedQty: number,
  currentPrice: number,
  sourceAccounts: PortfolioSourceAccount[],
  holdDays: number,
  existingItems: ExistingPortfolioItem[],
  buyDate: Date,
  note: string,
): CreatePortfolioItemInput[] {
  const existingForCase = existingItems
    .filter((item) => String(item.caseId) === caseId)
    .sort(
      (a, b) => new Date(a.buyDate).getTime() - new Date(b.buyDate).getTime(),
    );

  const totalExistingQty = existingForCase.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0,
  );
  const tradeHoldUntil =
    holdDays > 0
      ? new Date(buyDate.getTime() + holdDays * 24 * 60 * 60 * 1000)
      : undefined;

  if (totalExistingQty === 0) {
    return [
      {
        caseId,
        quantity: totalScannedQty,
        buyPrice: currentPrice,
        buyDate,
        isTemporaryPrice: true,
        tradeHoldUntil,
        sourceAccounts,
        note,
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
      sourceAccounts: updateSourceAccounts(
        item.sourceAccounts || [],
        sourceAccounts,
      ),
      note: item.note || note,
    }));
  }

  if (totalScannedQty > totalExistingQty) {
    const resolved = existingForCase.map((item) => ({
      caseId,
      quantity: Number(item.quantity),
      buyPrice: Number(item.buyPrice),
      buyDate: new Date(item.buyDate),
      isTemporaryPrice: item.isTemporaryPrice,
      tradeHoldUntil,
      sourceAccounts: updateSourceAccounts(
        item.sourceAccounts || [],
        sourceAccounts,
      ),
      note: item.note || note,
    }));

    resolved.push({
      caseId,
      quantity: totalScannedQty - totalExistingQty,
      buyPrice: currentPrice,
      buyDate,
      isTemporaryPrice: true,
      tradeHoldUntil,
      sourceAccounts,
      note,
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
        sourceAccounts: updateSourceAccounts(
          item.sourceAccounts || [],
          sourceAccounts,
        ),
        note: item.note || note,
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
        sourceAccounts: updateSourceAccounts(
          item.sourceAccounts || [],
          sourceAccounts,
        ),
        note: item.note || note,
      });
      remainingToKeep = 0;
    }
  }

  return resolved;
}
