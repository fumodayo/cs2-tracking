import type { PortfolioReportRowDto } from '@/types/report';
import type { PortfolioTableRow } from './portfolio-table-model';

export function splitSellSelectedItem(
  item: PortfolioTableRow,
  originalRows?: PortfolioReportRowDto[]
): PortfolioTableRow[] {
  if (item.itemType !== 'skin') {
    return [item];
  }

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
