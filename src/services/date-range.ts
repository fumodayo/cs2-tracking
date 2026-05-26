import type { PriceRange } from "@/domain/price";

export function getRangeStartDate(range: PriceRange, now = new Date()): Date {
  const date = new Date(now);

  switch (range) {
    case "7d":
      date.setDate(date.getDate() - 7);
      return date;
    case "1m":
      date.setMonth(date.getMonth() - 1);
      return date;
    case "3m":
      date.setMonth(date.getMonth() - 3);
      return date;
    case "6m":
      date.setMonth(date.getMonth() - 6);
      return date;
    case "1y":
      date.setFullYear(date.getFullYear() - 1);
      return date;
  }
}
