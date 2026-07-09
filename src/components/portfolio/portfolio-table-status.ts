import { getRemainingHoldDays } from '@/utils/date';

export function getItemStatusBreakdown(item: {
  sourceType: string;
  quantity: number;
  tradeHoldUntil: string | null;
  sourceAccounts?: Array<{
    steamId64: string;
    name: string;
    breakdown?: {
      tradeable: number;
      onMarket: number;
      tradeProtected: number;
      hold: number;
    };
  }>;
}) {
  const consolidated = {
    tradeable: 0,
    onMarket: 0,
    tradeProtected: 0,
    hold: 0,
  };

  let hasBreakdown = false;
  if (item.sourceAccounts && item.sourceAccounts.length > 0) {
    for (const acc of item.sourceAccounts) {
      if (acc.breakdown) {
        hasBreakdown = true;
        consolidated.tradeable += acc.breakdown.tradeable ?? 0;
        consolidated.onMarket += acc.breakdown.onMarket ?? 0;
        consolidated.tradeProtected += acc.breakdown.tradeProtected ?? 0;
        consolidated.hold += acc.breakdown.hold ?? 0;
      }
    }
  }

  if (!hasBreakdown) {
    const holdDays = getRemainingHoldDays(item.tradeHoldUntil);

    if (holdDays > 0) {
      consolidated.hold = item.quantity;
    } else {
      consolidated.tradeable = item.quantity;
    }
  }

  return consolidated;
}
