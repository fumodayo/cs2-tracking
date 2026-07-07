import type { PortfolioTableRow } from '../portfolio-table-model';
import { calculateTradeHoldUntil, getRemainingHoldDays } from '@/utils/date';

export type ItemTradeState = 'tradeable' | 'hold' | 'protected';

export type ItemHoverCardAccountOption = {
  id: string;
  steamId64: string;
  name: string;
};

type ItemLotSourceAccount = {
  steamId64: string;
  name: string;
  breakdown: {
    tradeable: number;
    onMarket: number;
    tradeProtected: number;
    hold: number;
    holdDetails: Array<{ quantity: number; holdDays: number }>;
  };
};

export function getDefaultItemTradeState(
  item: Pick<PortfolioTableRow, 'sourceAccounts' | 'tradeHoldUntil'>
): {
  state: ItemTradeState;
  holdDays: string;
} {
  const lotHoldDays = getRemainingHoldDays(item.tradeHoldUntil);
  const isProtected = Boolean(
    item.sourceAccounts?.[0]?.breakdown?.tradeProtected &&
    item.sourceAccounts[0].breakdown.tradeProtected > 0
  );

  if (isProtected) {
    return { state: 'protected', holdDays: '' };
  }
  if (lotHoldDays > 0) {
    return { state: 'hold', holdDays: String(lotHoldDays) };
  }
  return { state: 'tradeable', holdDays: '' };
}

export function buildLotSourceAccounts({
  editAccountId,
  accountOptions,
  editState,
  quantity,
  editHoldDays,
}: {
  editAccountId: string;
  accountOptions: ItemHoverCardAccountOption[];
  editState: ItemTradeState;
  quantity: number;
  editHoldDays: string;
}): ItemLotSourceAccount[] | [] | undefined {
  if (!editAccountId) {
    return [];
  }

  const selectedAccount = accountOptions.find((account) => account.steamId64 === editAccountId);
  if (!selectedAccount) {
    return undefined;
  }

  return [
    {
      steamId64: editAccountId,
      name: selectedAccount.name,
      breakdown: {
        tradeable: editState === 'tradeable' ? quantity : 0,
        onMarket: 0,
        tradeProtected: editState === 'protected' ? quantity : 0,
        hold: editState === 'hold' ? quantity : 0,
        holdDetails:
          editState === 'hold' || editState === 'protected'
            ? [
                {
                  quantity,
                  holdDays: Number(editHoldDays) || 0,
                },
              ]
            : [],
      },
    },
  ];
}

export function getTradeHoldUntilForState({
  editState,
  editHoldDays,
  buyDate,
}: {
  editState: ItemTradeState;
  editHoldDays: string;
  buyDate?: string | Date | null;
}): string | null {
  if (editState !== 'hold' && editState !== 'protected') {
    return null;
  }
  if (!editHoldDays) {
    return null;
  }

  const days = Number(editHoldDays) || 0;
  if (days <= 0) {
    return null;
  }

  const baseDate = buyDate ? new Date(buyDate) : new Date();
  return calculateTradeHoldUntil(baseDate, days).toISOString();
}

export function getItemHoverCardTargetId(
  item: Pick<PortfolioTableRow, 'id'>,
  relatedRows: Array<Pick<PortfolioTableRow, 'id'>>
): string {
  return relatedRows.length === 1 ? relatedRows[0].id : item.id;
}
