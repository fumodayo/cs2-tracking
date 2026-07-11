import type { PortfolioReportDto } from '@/types/report';
import type { PortfolioImportRow } from '@/types/portfolio-import';

export const PORTFOLIO_QUERY_KEY = ['portfolio-report'];

export type PortfolioImportResponse = PortfolioReportDto & {
  importResult?: {
    importedCount: number;
    importedIds: string[];
  };
};

export type PortfolioImportProgress = {
  total: number;
  index: number;
  message?: string;
};

export type ImportPortfolioRowsOptions = {
  onProgress?: (progress: PortfolioImportProgress) => void;
};

export async function fetchPortfolioReport(): Promise<PortfolioReportDto> {
  const response = await fetch('/api/portfolio', { cache: 'no-store' });
  return parseResponse<PortfolioReportDto>(response);
}

export async function fetchFreshPortfolioReport(): Promise<PortfolioReportDto> {
  const response = await fetch('/api/portfolio?fresh=1', { cache: 'no-store' });
  return parseResponse<PortfolioReportDto>(response);
}

export async function refreshPortfolioPrices(): Promise<PortfolioReportDto> {
  const response = await fetch('/api/prices/refresh', { method: 'POST' });
  return parseResponse<PortfolioReportDto>(response);
}

export async function addPortfolioItem(payload: {
  caseId: string;
  quantity: number;
  buyPrice: number;
  buyDate: string;
  note?: string;
  sourceAccounts?: Array<{
    steamId64: string;
    name: string;
    breakdown?: {
      tradeable: number;
      onMarket: number;
      tradeProtected: number;
      hold: number;
      holdDetails?: Array<{ quantity: number; holdDays: number }>;
    };
  }>;
  storageUnitId?: string;
  tradeHoldUntil?: string | null;
  stickerPriceRate?: number;
  stickerBuyPriceRate?: number;
  stickerScanTotalPrice?: number;
  stickerScanPriceCapturedAt?: string;
}): Promise<PortfolioReportDto> {
  const response = await fetch('/api/portfolio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse<PortfolioReportDto>(response);
}

export async function deletePortfolioItem(id: string): Promise<PortfolioReportDto> {
  const response = await fetch(`/api/portfolio/${id}`, { method: 'DELETE' });
  return parseResponse<PortfolioReportDto>(response);
}

export async function deleteManyPortfolioItems(ids: string[]): Promise<PortfolioReportDto> {
  const response = await fetch('/api/portfolio', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  return parseResponse<PortfolioReportDto>(response);
}

export async function updatePortfolioItem(payload: {
  id: string;
  buyPrice?: number;
  quantity?: number;
  note?: string;
  sourceAccounts?: Array<{
    steamId64: string;
    name: string;
    breakdown?: {
      tradeable: number;
      onMarket: number;
      tradeProtected: number;
      hold: number;
      holdDetails?: Array<{ quantity: number; holdDays: number }>;
    };
  }>;
  storageUnitId?: string;
  tradeHoldUntil?: string | null;
  stickerPriceRate?: number;
  stickerBuyPriceRate?: number;
  stickerScanTotalPrice?: number;
  stickerScanPriceCapturedAt?: string;
}): Promise<PortfolioReportDto> {
  const body: Record<string, unknown> = {};
  if (payload.buyPrice !== undefined) body.buyPrice = payload.buyPrice;
  if (payload.quantity !== undefined) body.quantity = payload.quantity;
  if (payload.note !== undefined) body.note = payload.note;
  if (payload.sourceAccounts !== undefined) body.sourceAccounts = payload.sourceAccounts;
  if (payload.storageUnitId !== undefined) body.storageUnitId = payload.storageUnitId;
  if (payload.tradeHoldUntil !== undefined) body.tradeHoldUntil = payload.tradeHoldUntil;
  if (payload.stickerPriceRate !== undefined) body.stickerPriceRate = payload.stickerPriceRate;
  if (payload.stickerBuyPriceRate !== undefined)
    body.stickerBuyPriceRate = payload.stickerBuyPriceRate;
  if (payload.stickerScanTotalPrice !== undefined)
    body.stickerScanTotalPrice = payload.stickerScanTotalPrice;
  if (payload.stickerScanPriceCapturedAt !== undefined)
    body.stickerScanPriceCapturedAt = payload.stickerScanPriceCapturedAt;

  const response = await fetch(`/api/portfolio/${payload.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseResponse<PortfolioReportDto>(response);
}

export async function importPortfolioRows(
  rows: PortfolioImportRow[],
  options: ImportPortfolioRowsOptions = {}
): Promise<PortfolioImportResponse> {
  const response = await fetch('/api/portfolio/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message ?? 'requestFailed');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('cannotReadStream');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: PortfolioImportResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      if (event.type === 'progress') {
        options.onProgress?.({
          total: event.total,
          index: event.index,
          message: event.message,
        });
      } else if (event.type === 'complete') {
        finalResult = event.result;
      } else if (event.type === 'error') {
        throw new Error(event.message);
      }
    }
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer);
    if (event.type === 'progress') {
      options.onProgress?.({
        total: event.total,
        index: event.index,
        message: event.message,
      });
    } else if (event.type === 'complete') {
      finalResult = event.result;
    } else if (event.type === 'error') {
      throw new Error(event.message);
    }
  }

  if (!finalResult) {
    throw new Error('noCompleteResultFromServer');
  }

  return finalResult;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? 'requestFailed');
  }

  return data as T;
}
