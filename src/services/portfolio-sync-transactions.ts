import type { PortfolioSourceAccount, CreatePortfolioItemInput } from '@/domain/portfolio-item';
import type { PatternInfo } from '@/domain/pattern-info';
import { calculateTradeHoldUntil } from '@/utils/date';
import { buildItemVariantKey } from '@/utils/item-identity';

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
  patternInfo?: PatternInfo;
  stickerPriceRate?: number;
  stickerBuyPriceRate?: number;
  stickerBuyPriceAdd?: number;
  stickerScanTotalPrice?: number;
  stickerScanPriceCapturedAt?: Date;
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
  patternInfo?: PatternInfo,
  stickerFields?: Pick<
    CreatePortfolioItemInput,
    | 'stickerPriceRate'
    | 'stickerBuyPriceRate'
    | 'stickerScanTotalPrice'
    | 'stickerScanPriceCapturedAt'
  >
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
        }) === scannedVariantKey
    )
    .sort((a, b) => new Date(a.buyDate).getTime() - new Date(b.buyDate).getTime());

  const totalExistingQty = existingForCase.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );
  const tradeHoldUntil =
    tradeHoldUntilParam ?? (holdDays > 0 ? calculateTradeHoldUntil(buyDate, holdDays) : undefined);

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
      stickerBuyPriceRate: item.stickerBuyPriceRate ?? stickerFields?.stickerBuyPriceRate,
      stickerScanTotalPrice: item.stickerScanTotalPrice ?? stickerFields?.stickerScanTotalPrice,
      stickerScanPriceCapturedAt:
        item.stickerScanPriceCapturedAt ?? stickerFields?.stickerScanPriceCapturedAt,
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
      stickerBuyPriceRate: item.stickerBuyPriceRate ?? stickerFields?.stickerBuyPriceRate,
      stickerScanTotalPrice: item.stickerScanTotalPrice ?? stickerFields?.stickerScanTotalPrice,
      stickerScanPriceCapturedAt:
        item.stickerScanPriceCapturedAt ?? stickerFields?.stickerScanPriceCapturedAt,
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
        stickerPriceRate: item.stickerPriceRate ?? stickerFields?.stickerPriceRate,
        stickerBuyPriceRate: item.stickerBuyPriceRate ?? stickerFields?.stickerBuyPriceRate,
        stickerScanTotalPrice: item.stickerScanTotalPrice ?? stickerFields?.stickerScanTotalPrice,
        stickerScanPriceCapturedAt:
          item.stickerScanPriceCapturedAt ?? stickerFields?.stickerScanPriceCapturedAt,
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
        stickerPriceRate: item.stickerPriceRate ?? stickerFields?.stickerPriceRate,
        stickerBuyPriceRate: item.stickerBuyPriceRate ?? stickerFields?.stickerBuyPriceRate,
        stickerScanTotalPrice: item.stickerScanTotalPrice ?? stickerFields?.stickerScanTotalPrice,
        stickerScanPriceCapturedAt:
          item.stickerScanPriceCapturedAt ?? stickerFields?.stickerScanPriceCapturedAt,
      });
      remainingToKeep = 0;
    }
  }

  return resolved;
}
