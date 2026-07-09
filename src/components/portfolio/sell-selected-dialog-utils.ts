import type { PortfolioReportRowDto } from '@/types/report';
import type { PortfolioTableRow } from './portfolio-table-model';

type SellSelectedRateMap = Record<string, string>;

export type SellSelectedMetrics = {
  totalInvested: number;
  totalCurrentValue: number;
  profitAmount: number;
  profitPercent: number;
};

export type SellSelectedAllocatedAccount = {
  steamId64: string;
  name: string;
  tradable: number;
  onMarket: number;
  hold: number;
};

export type SellSelectedRowPricing = {
  hasBuff: boolean;
  unitCurrent: number;
  isFullSell: boolean;
  itemRetailRateVal: number;
  itemWholesaleRateVal: number;
  activeRate: number;
  activeRateStr: string;
  itemStickerRateVal: string;
  stickerScanTotalPrice: number;
  stickerPriceAdd: number;
  unitSell: number;
  rowInvested: number;
  rowCurrentValue: number;
  rowProfit: number;
  rowProfitPositive: boolean;
};

export function splitSellSelectedItem(
  item: PortfolioTableRow,
  originalRows?: PortfolioReportRowDto[]
): PortfolioTableRow[] {
  if (item.itemType !== 'skin') {
    return [item];
  }

  // Dòng summary skin có thể đại diện cho nhiều pattern và rate sticker ở cấp asset.
  // Tách thành các lô một dòng để thao tác bán trừ đúng vật phẩm portfolio gốc.
  const count = item.quantity;
  const result: PortfolioTableRow[] = [];
  for (let i = 0; i < count; i++) {
    const dbId = item.itemIds.length > i ? item.itemIds[i] : item.id;
    const dbRow = originalRows?.find((row) => row.item.id === dbId);
    result.push({
      ...item,
      id: count > 1 ? `${item.id}_split_${i}` : item.id,
      quantity: 1,
      itemIds: [dbId],
      buyPrice: dbRow?.item.buyPrice ?? item.buyPrice,
      buyDate: dbRow?.item.buyDate ?? item.buyDate,
      note: dbRow?.item.note ?? item.note,
      tradeHoldUntil: dbRow?.item.tradeHoldUntil ?? item.tradeHoldUntil,
      sourceAccounts: dbRow?.item.sourceAccounts ?? item.sourceAccounts,
      patternInfo: dbRow?.item.patternInfo ?? item.patternInfo,
      stickerPriceRate: dbRow?.item.stickerPriceRate ?? item.stickerPriceRate,
      stickerBuyPriceRate: dbRow?.item.stickerBuyPriceRate ?? item.stickerBuyPriceRate,
      stickerScanTotalPrice: dbRow?.item.stickerScanTotalPrice ?? item.stickerScanTotalPrice,
      stickerScanPriceCapturedAt:
        dbRow?.item.stickerScanPriceCapturedAt ?? item.stickerScanPriceCapturedAt,
    });
  }
  return result;
}

export function hasSellSelectedBuffPricing(item: PortfolioTableRow): boolean {
  return (
    item.itemType === 'skin' &&
    item.currentPrice !== null &&
    item.steamPrice !== null &&
    item.steamPrice !== undefined &&
    item.currentPrice !== item.steamPrice
  );
}

export function hasSellSelectedBuffFilterMatch(
  item: PortfolioTableRow,
  buffPricesCny?: Record<string, number>
): boolean {
  return (
    hasSellSelectedBuffPricing(item) ||
    (buffPricesCny?.[item.case.marketHashName] !== undefined &&
      buffPricesCny[item.case.marketHashName] > 0)
  );
}

export function getDefaultSellSelectedBuffCnyPrice({
  item,
  buffPricesCny,
  buffCnyToVndRate,
}: {
  item: PortfolioTableRow;
  buffPricesCny?: Record<string, number>;
  buffCnyToVndRate?: number;
}): number {
  return (
    buffPricesCny?.[item.case.marketHashName] ??
    (item.currentPrice ? item.currentPrice / (buffCnyToVndRate ?? 3600) : 0)
  );
}

export function calculateSellSelectedTotalTradableQty({
  item,
  maxQty,
  now,
}: {
  item: PortfolioTableRow;
  maxQty: number;
  now: number;
}): number {
  let total = 0;
  if (item.sourceAccounts && item.sourceAccounts.length > 0) {
    let hasAnyBreakdown = false;
    for (const account of item.sourceAccounts) {
      if (account.breakdown) {
        hasAnyBreakdown = true;
        total += account.breakdown.tradeable ?? 0;
      }
    }
    if (!hasAnyBreakdown) {
      const hasHold = item.tradeHoldUntil ? new Date(item.tradeHoldUntil).getTime() > now : false;
      total = hasHold ? 0 : item.quantity;
    }
  } else {
    const hasHold = item.tradeHoldUntil ? new Date(item.tradeHoldUntil).getTime() > now : false;
    total = hasHold ? 0 : item.quantity;
  }
  return Math.min(total, maxQty);
}

export function calculateSellSelectedAllocatedAccounts({
  item,
  maxQty,
  now,
}: {
  item: PortfolioTableRow;
  maxQty: number;
  now: number;
}): SellSelectedAllocatedAccount[] {
  if (!item.sourceAccounts) return [];
  let remaining = maxQty;
  // Phân bổ số lượng bán đang hiển thị qua breakdown tài khoản theo thứ tự nguồn.
  return item.sourceAccounts.map((account) => {
    const hasBreakdown = !!account.breakdown;
    if (!hasBreakdown) {
      const hasHold = item.tradeHoldUntil ? new Date(item.tradeHoldUntil).getTime() > now : false;
      const tradableQty = hasHold ? 0 : Math.min(item.quantity, remaining);
      remaining -= tradableQty;
      const holdQty = hasHold ? Math.min(item.quantity, remaining) : 0;
      remaining -= holdQty;
      return {
        steamId64: account.steamId64,
        name: account.name,
        tradable: tradableQty,
        onMarket: 0,
        hold: holdQty,
      };
    }
    const rawTradable = account.breakdown?.tradeable ?? 0;
    const rawOnMarket = account.breakdown?.onMarket ?? 0;
    const rawHold = account.breakdown?.hold ?? 0;

    const tradableQty = Math.min(rawTradable, remaining);
    remaining -= tradableQty;

    const onMarketQty = Math.min(rawOnMarket, remaining);
    remaining -= onMarketQty;

    const holdQty = Math.min(rawHold, remaining);
    remaining -= holdQty;

    return {
      steamId64: account.steamId64,
      name: account.name,
      tradable: tradableQty,
      onMarket: onMarketQty,
      hold: holdQty,
    };
  });
}

export function calculateSellSelectedRowPricing({
  item,
  sellQty,
  maxQty,
  wholesaleRate,
  retailRate,
  buffPricesCny,
  buffCnyToVndRate,
  buffCnyPrices,
  buffRates,
  itemRetailRates,
  itemWholesaleRates,
  itemStickerRates,
  getItemStickerScanTotal,
}: {
  item: PortfolioTableRow;
  sellQty: number;
  maxQty: number;
  wholesaleRate: number;
  retailRate: number;
  buffPricesCny?: Record<string, number>;
  buffCnyToVndRate?: number;
  buffCnyPrices: SellSelectedRateMap;
  buffRates: SellSelectedRateMap;
  itemRetailRates: SellSelectedRateMap;
  itemWholesaleRates: SellSelectedRateMap;
  itemStickerRates: SellSelectedRateMap;
  getItemStickerScanTotal: (item: PortfolioTableRow) => number;
}): SellSelectedRowPricing {
  const unitBuy = item.buyPrice;
  let unitCurrent = item.currentPrice ?? item.buyPrice;
  const hasBuff = hasSellSelectedBuffPricing(item);

  // Dòng định giá bằng BUFF dùng input CNY làm giá gốc; dòng không BUFF dùng phần trăm rate.
  if (hasBuff) {
    const cnyPriceVal = Number(
      buffCnyPrices[item.id] !== undefined
        ? buffCnyPrices[item.id]
        : getDefaultSellSelectedBuffCnyPrice({ item, buffPricesCny, buffCnyToVndRate })
    );
    const cnyRateVal = Number(
      buffRates[item.id] !== undefined ? buffRates[item.id] : (buffCnyToVndRate ?? 3600)
    );
    unitCurrent = Math.round(cnyPriceVal * cnyRateVal);
  }

  const isFullSell = sellQty === maxQty;
  const itemRetailRateVal = Number(
    itemRetailRates[item.id] !== undefined ? itemRetailRates[item.id] : retailRate
  );
  const itemWholesaleRateVal = Number(
    itemWholesaleRates[item.id] !== undefined ? itemWholesaleRates[item.id] : wholesaleRate
  );

  const activeRate = hasBuff ? 100 : !isFullSell ? itemRetailRateVal : itemWholesaleRateVal;
  const activeRateStr = isFullSell
    ? itemWholesaleRates[item.id] !== undefined
      ? itemWholesaleRates[item.id]
      : String(wholesaleRate)
    : itemRetailRates[item.id] !== undefined
      ? itemRetailRates[item.id]
      : String(retailRate);

  const itemStickerRateVal =
    itemStickerRates[item.id] !== undefined ? itemStickerRates[item.id] : '0';
  const stickerScanTotalPrice = getItemStickerScanTotal(item);
  // Phần cộng thêm sticker được định giá độc lập với rate skin gốc.
  const stickerPriceAdd =
    stickerScanTotalPrice > 0
      ? Math.round((stickerScanTotalPrice * Number(itemStickerRateVal)) / 100)
      : 0;

  const unitSell = Math.round(unitCurrent * (activeRate / 100)) + stickerPriceAdd;
  const rowInvested = unitBuy * sellQty;
  const rowCurrentValue = unitSell * sellQty;
  const rowProfit = rowCurrentValue - rowInvested;

  return {
    hasBuff,
    unitCurrent,
    isFullSell,
    itemRetailRateVal,
    itemWholesaleRateVal,
    activeRate,
    activeRateStr,
    itemStickerRateVal,
    stickerScanTotalPrice,
    stickerPriceAdd,
    unitSell,
    rowInvested,
    rowCurrentValue,
    rowProfit,
    rowProfitPositive: rowProfit >= 0,
  };
}

export function calculateSellSelectedMetrics({
  activeItems,
  sellQuantities,
  itemRetailRates,
  itemWholesaleRates,
  wholesaleRate,
  retailRate,
  buffCnyPrices,
  buffRates,
  buffPricesCny,
  buffCnyToVndRate,
  itemStickerRates,
  getItemStickerScanTotal,
}: {
  activeItems: PortfolioTableRow[];
  sellQuantities: Record<string, number>;
  itemRetailRates: SellSelectedRateMap;
  itemWholesaleRates: SellSelectedRateMap;
  wholesaleRate: number;
  retailRate: number;
  buffCnyPrices: SellSelectedRateMap;
  buffRates: SellSelectedRateMap;
  buffPricesCny?: Record<string, number>;
  buffCnyToVndRate?: number;
  itemStickerRates: SellSelectedRateMap;
  getItemStickerScanTotal: (item: PortfolioTableRow) => number;
}): SellSelectedMetrics {
  let totalInvested = 0;
  let totalCurrentValue = 0;

  activeItems.forEach((item) => {
    const qty = sellQuantities[item.id] !== undefined ? sellQuantities[item.id] : item.quantity;
    const hasBuff = hasSellSelectedBuffPricing(item);
    const unitBuy = item.buyPrice;
    let unitCurrent = item.currentPrice ?? item.buyPrice;

    if (hasBuff) {
      const cnyPriceVal = Number(
        buffCnyPrices[item.id] !== undefined
          ? buffCnyPrices[item.id]
          : getDefaultSellSelectedBuffCnyPrice({ item, buffPricesCny, buffCnyToVndRate })
      );
      const cnyRateVal = Number(
        buffRates[item.id] !== undefined ? buffRates[item.id] : (buffCnyToVndRate ?? 3600)
      );
      unitCurrent = Math.round(cnyPriceVal * cnyRateVal);
    }

    let unitSellDynamic = unitCurrent;

    if (!hasBuff) {
      const itemRetailRateVal = Number(
        itemRetailRates[item.id] !== undefined ? itemRetailRates[item.id] : retailRate
      );
      const itemWholesaleRateVal = Number(
        itemWholesaleRates[item.id] !== undefined ? itemWholesaleRates[item.id] : wholesaleRate
      );

      const rateDynamic = qty < item.quantity ? itemRetailRateVal : itemWholesaleRateVal;
      unitSellDynamic = Math.round(unitCurrent * (rateDynamic / 100));
    }

    const stickerScanTotalPrice = getItemStickerScanTotal(item);
    if (stickerScanTotalPrice > 0) {
      const itemStickerRateVal = Number(
        itemStickerRates[item.id] !== undefined ? itemStickerRates[item.id] : 0
      );
      unitSellDynamic += Math.round((stickerScanTotalPrice * itemStickerRateVal) / 100);
    }

    totalInvested += unitBuy * qty;
    totalCurrentValue += unitSellDynamic * qty;
  });

  const profitAmount = totalCurrentValue - totalInvested;
  const profitPercent = totalInvested > 0 ? (profitAmount / totalInvested) * 100 : 0;

  return {
    totalInvested,
    totalCurrentValue,
    profitAmount,
    profitPercent,
  };
}
