import type { PatternInfo } from '@/domain/pattern-info';
import type { PortfolioSourceAccount } from '@/domain/portfolio-item';
import type { InventoryImportItem } from './import-inventory-types';

// Endpoint import nhận JSON do client kiểm soát, nên mọi trường được chuẩn hóa trước khi dùng.
export function normalizeItems(value: unknown): InventoryImportItem[] {
  if (!Array.isArray(value)) {
    throw new Error('importErrorInvalidPayload');
  }

  return value.filter(isRecord) as InventoryImportItem[];
}

export function getOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function getOptionalNumber(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : undefined;
}

export function normalizePatternInfo(value: unknown): PatternInfo | undefined {
  return isRecord(value) ? (value as PatternInfo) : undefined;
}

export function getOptionalDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value as string | number | Date);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

export function normalizeSourceAccounts(value: unknown): PortfolioSourceAccount[] {
  if (!Array.isArray(value)) {
    return [];
  }

  // Loại tài khoản sai định dạng từ sớm; logic merge/import phía sau giả định có SteamID và tên.
  return value
    .filter(isRecord)
    .map((account) => {
      const breakdownVal = isRecord(account.breakdown) ? account.breakdown : undefined;
      const breakdown = breakdownVal
        ? {
            tradeable: typeof breakdownVal.tradeable === 'number' ? breakdownVal.tradeable : 0,
            onMarket: typeof breakdownVal.onMarket === 'number' ? breakdownVal.onMarket : 0,
            tradeProtected:
              typeof breakdownVal.tradeProtected === 'number' ? breakdownVal.tradeProtected : 0,
            hold: typeof breakdownVal.hold === 'number' ? breakdownVal.hold : 0,
            holdDetails: Array.isArray(breakdownVal.holdDetails)
              ? breakdownVal.holdDetails.filter(isRecord).map((hd) => ({
                  quantity: typeof hd.quantity === 'number' ? hd.quantity : 0,
                  holdDays: typeof hd.holdDays === 'number' ? hd.holdDays : 0,
                }))
              : undefined,
          }
        : undefined;

      return {
        steamId64: getOptionalString(account.steamId64) ?? '',
        name: getOptionalString(account.name) ?? '',
        breakdown,
      };
    })
    .filter((account) => account.steamId64 && account.name);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
