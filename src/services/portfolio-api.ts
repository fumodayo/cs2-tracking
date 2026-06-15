import type { PortfolioReportDto } from "@/types/report";
import type { PortfolioImportRow } from "@/components/portfolio";
import { getErrorMessage } from "@/utils/error";

export const PORTFOLIO_QUERY_KEY = ["portfolio-report"];

export type PortfolioImportResponse = PortfolioReportDto & {
  importResult?: {
    importedCount: number;
    importedIds: string[];
  };
};

export async function fetchPortfolioReport(): Promise<PortfolioReportDto> {
  const response = await fetch("/api/portfolio", { cache: "no-store" });
  return parseResponse<PortfolioReportDto>(response);
}

export async function refreshPortfolioPrices(): Promise<PortfolioReportDto> {
  const response = await fetch("/api/prices/refresh", { method: "POST" });
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
}): Promise<PortfolioReportDto> {
  const response = await fetch("/api/portfolio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse<PortfolioReportDto>(response);
}

export async function deletePortfolioItem(id: string): Promise<PortfolioReportDto> {
  const response = await fetch(`/api/portfolio/${id}`, { method: "DELETE" });
  return parseResponse<PortfolioReportDto>(response);
}

export async function deleteManyPortfolioItems(
  ids: string[],
): Promise<PortfolioReportDto> {
  const response = await fetch("/api/portfolio", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
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
}): Promise<PortfolioReportDto> {
  const body: Record<string, unknown> = {};
  if (payload.buyPrice !== undefined) body.buyPrice = payload.buyPrice;
  if (payload.quantity !== undefined) body.quantity = payload.quantity;
  if (payload.note !== undefined) body.note = payload.note;
  if (payload.sourceAccounts !== undefined)
    body.sourceAccounts = payload.sourceAccounts;
  if (payload.storageUnitId !== undefined)
    body.storageUnitId = payload.storageUnitId;
  if (payload.tradeHoldUntil !== undefined)
    body.tradeHoldUntil = payload.tradeHoldUntil;

  const response = await fetch(`/api/portfolio/${payload.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse<PortfolioReportDto>(response);
}

export async function importPortfolioRows(
  rows: PortfolioImportRow[],
): Promise<PortfolioImportResponse> {
  const response = await fetch("/api/portfolio/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });
  return parseResponse<PortfolioImportResponse>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? "Request thất bại.");
  }

  return data as T;
}

export { getErrorMessage };
