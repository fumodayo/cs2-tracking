import { formatDecimalViInput, formatIntegerViInput } from '@/utils/format';
import type { PortfolioTableRow } from '../portfolio-table-model';
import { toInputNumber } from '../portfolio-table-utils';
import { getDefaultItemTradeState, type ItemTradeState } from './lot-update-helpers';

export type ItemHoverCardFormValues = {
  quantity: string;
  priceCny: string;
  buyRate: string;
  priceVnd: string;
  note: string;
  sellRate: string;
  sellPriceCny: string;
  editAccountId: string;
  editStorageUnitId: string;
  editState: ItemTradeState;
  editHoldDays: string;
  stickerRate: string;
  stickerBuyRate: string;
  capturedScanTotal: number | null;
  capturedScanDate?: string;
};

type ItemHoverCardDraftValues = Partial<
  Omit<ItemHoverCardFormValues, 'editState'> & {
    editState: ItemTradeState;
  }
>;

export function getItemHoverCardDefaultFormValues({
  item,
  hasBuff,
  buffCnyToVndRate,
  buffPricesCny,
}: {
  item: PortfolioTableRow;
  hasBuff: boolean;
  buffCnyToVndRate?: number;
  buffPricesCny?: Record<string, number>;
}): ItemHoverCardFormValues {
  const defaultVnd = item.buyPrice || item.steamPrice || item.currentPrice || 0;
  const defaultMarket = item.steamPrice || item.currentPrice || 0;
  const defaultTradeState = getDefaultItemTradeState(item);

  const defaultSellCnyVal =
    buffPricesCny?.[item.case.marketHashName] ||
    (hasBuff ? defaultMarket / (buffCnyToVndRate ?? 3600) : 0);

  return {
    quantity: formatIntegerViInput(item.quantity),
    priceCny: hasBuff
      ? formatDecimalViInput(defaultVnd / (buffCnyToVndRate ?? 3600))
      : formatIntegerViInput(defaultMarket),
    buyRate: hasBuff ? formatIntegerViInput(buffCnyToVndRate ?? 3600) : '100',
    priceVnd: formatIntegerViInput(defaultVnd),
    note: item.note ?? '',
    sellRate: formatIntegerViInput(buffCnyToVndRate ?? 3600),
    sellPriceCny: formatDecimalViInput(defaultSellCnyVal),
    editAccountId: item.sourceAccounts?.[0]?.steamId64 ?? '',
    editStorageUnitId: item.storageUnitId ?? '',
    editState: defaultTradeState.state,
    editHoldDays: defaultTradeState.holdDays,
    stickerRate: String(item.stickerPriceRate ?? 0),
    stickerBuyRate: String(item.stickerBuyPriceRate ?? 0),
    capturedScanTotal: item.stickerScanTotalPrice ?? null,
    capturedScanDate: item.stickerScanPriceCapturedAt,
  };
}

export function getItemHoverCardDraftFormValues({
  item,
  draft,
  hasBuff,
  buffCnyToVndRate,
  buffPricesCny,
}: {
  item: PortfolioTableRow;
  draft: ItemHoverCardDraftValues;
  hasBuff: boolean;
  buffCnyToVndRate?: number;
  buffPricesCny?: Record<string, number>;
}): ItemHoverCardFormValues {
  const defaultValues = getItemHoverCardDefaultFormValues({
    item,
    hasBuff,
    buffCnyToVndRate,
    buffPricesCny,
  });
  const defaultVnd = item.buyPrice || item.steamPrice || item.currentPrice || 0;
  const defaultMarket = item.steamPrice || item.currentPrice || 0;

  const defaultSellCnyVal =
    buffPricesCny?.[item.case.marketHashName] ||
    (hasBuff ? defaultMarket / (buffCnyToVndRate ?? 3600) : 0);

  if (hasBuff) {
    return {
      ...defaultValues,
      quantity: formatIntegerViInput(draft.quantity ?? String(item.quantity)),
      priceVnd: formatIntegerViInput(draft.priceVnd ?? toInputNumber(defaultVnd)),
      priceCny: formatDecimalViInput(
        draft.priceCny ?? toInputNumber(defaultVnd / (buffCnyToVndRate ?? 3600))
      ),
      buyRate: formatIntegerViInput(draft.buyRate ?? toInputNumber(buffCnyToVndRate ?? 3600)),
      note: draft.note ?? item.note ?? '',
      sellPriceCny: formatDecimalViInput(draft.sellPriceCny ?? defaultSellCnyVal),
      editAccountId: draft.editAccountId ?? item.sourceAccounts?.[0]?.steamId64 ?? '',
      editStorageUnitId: draft.editStorageUnitId ?? item.storageUnitId ?? '',
      editState: draft.editState ?? 'tradeable',
      editHoldDays: draft.editHoldDays ?? '',
      stickerRate: draft.stickerRate ?? String(item.stickerPriceRate ?? 0),
      stickerBuyRate: draft.stickerBuyRate ?? String(item.stickerBuyPriceRate ?? 0),
      capturedScanTotal: draft.capturedScanTotal ?? item.stickerScanTotalPrice ?? null,
      capturedScanDate: draft.capturedScanDate ?? item.stickerScanPriceCapturedAt,
    };
  }

  return {
    ...defaultValues,
    quantity: formatIntegerViInput(draft.quantity ?? String(item.quantity)),
    priceVnd: formatIntegerViInput(draft.priceVnd ?? toInputNumber(defaultVnd)),
    priceCny: formatIntegerViInput(defaultMarket),
    buyRate: '100',
    note: draft.note ?? item.note ?? '',
    sellPriceCny: '0',
    editAccountId: draft.editAccountId ?? item.sourceAccounts?.[0]?.steamId64 ?? '',
    editStorageUnitId: draft.editStorageUnitId ?? item.storageUnitId ?? '',
    editState: draft.editState ?? 'tradeable',
    editHoldDays: draft.editHoldDays ?? '',
    stickerRate: draft.stickerRate ?? String(item.stickerPriceRate ?? 0),
    stickerBuyRate: draft.stickerBuyRate ?? String(item.stickerBuyPriceRate ?? 0),
    capturedScanTotal: draft.capturedScanTotal ?? item.stickerScanTotalPrice ?? null,
    capturedScanDate: draft.capturedScanDate ?? item.stickerScanPriceCapturedAt,
  };
}
