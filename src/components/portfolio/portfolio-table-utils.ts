import { formatDateTime } from "@/utils/format";
import type { PortfolioTableRow } from "./portfolio-table-model";

export function buildAccountOptions(rows: PortfolioTableRow[]) {
  const map = new Map<string, { steamId64: string; name: string }>();
  for (const row of rows) {
    for (const account of row.sourceAccounts) {
      map.set(account.steamId64, account);
    }
  }
  return Array.from(map.values()).sort((first, second) =>
    first.name.localeCompare(second.name),
  );
}

export function getBuyDateSortValue(value: string | null): number {
  if (!value) {
    return 0;
  }

  const firstValue = value.split("|")[0];
  const timestamp = new Date(firstValue).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function formatBuyDate(value: string | null): string {
  if (!value) {
    return "Chưa có";
  }

  const [from, to] = value.split("|");
  if (!to) {
    return formatDateTime(from).split(" ")[0];
  }

  return `${formatDateTime(from).split(" ")[0]} - ${formatDateTime(to).split(" ")[0]}`;
}

export function formatSourceAccountTitle(
  accounts: PortfolioTableRow["sourceAccounts"],
): string {
  return accounts.map((account) => account.name).join(", ");
}

export function calculateRatedValue(
  item: PortfolioTableRow,
  ratePercent: number,
): number | null {
  if (item.currentPrice === null || !Number.isFinite(ratePercent)) {
    return null;
  }

  const hasBuff =
    item.itemType === "skin" &&
    item.currentPrice !== null &&
    item.steamPrice !== null &&
    item.steamPrice !== undefined &&
    item.currentPrice !== item.steamPrice;

  if (hasBuff) {
    return null;
  }

  return Math.round(item.currentPrice * item.quantity * (ratePercent / 100));
}

export function getSteamMarketListingUrl(marketHashName: string): string {
  return `https://steamcommunity.com/market/listings/730/${encodeURIComponent(marketHashName)}`;
}

export function getItemTypeColor(type: PortfolioTableRow["itemType"]): string {
  switch (type) {
    case "skin":
      return "#b0c3d9"; // Consumer grade fallback
    case "sticker":
      return "#4b69ff";
    case "capsule":
    case "case":
      return "#b0c3d9"; // ALWAYS Consumer grade color
  }
}

export function getItemTypeLabel(type: PortfolioTableRow["itemType"]): string {
  switch (type) {
    case "skin":
      return "Skin";
    case "sticker":
      return "Sticker";
    case "capsule":
      return "Capsule";
    case "case":
      return "Case";
  }
}

export function colorWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function toInputNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, "");
}

export const PAGE_SIZES = [5, 10, 20, 50];
