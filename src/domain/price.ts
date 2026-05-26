export type PriceSnapshot = {
  id: string;
  caseId: string;
  price: number;
  currency: "VND";
  source: string;
  capturedAt: Date;
};

export type CurrentPrice = Omit<PriceSnapshot, "id">;

export type PriceRange = "7d" | "1m" | "3m" | "6m" | "1y";

export const PRICE_RANGES: PriceRange[] = ["7d", "1m", "3m", "6m", "1y"];

export const PRICE_RANGE_LABELS: Record<PriceRange, string> = {
  "7d": "7D",
  "1m": "1M",
  "3m": "3M",
  "6m": "6M",
  "1y": "1Y",
};
