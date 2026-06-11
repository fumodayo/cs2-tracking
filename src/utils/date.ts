import {
  format,
  formatDistanceToNow,
  differenceInDays,
  addDays,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { vi } from "date-fns/locale";
import type { PriceRange } from "@/domain/price";

/**
 * Format a date for display: "08/06/2026 14:30"
 */
export function formatDateTimeVi(
  value: string | Date | null | undefined,
): string {
  if (!value) return "Chưa cập nhật";
  const date = typeof value === "string" ? new Date(value) : value;
  if (isNaN(date.getTime())) return "Chưa cập nhật";
  return format(date, "dd/MM/yyyy HH:mm", { locale: vi });
}

/**
 * Format a date for display (date only): "08/06/2026"
 */
export function formatDateVi(value: string | Date | null | undefined): string {
  if (!value) return "Chưa rõ ngày";
  const date = typeof value === "string" ? new Date(value) : value;
  if (isNaN(date.getTime())) return "Chưa rõ ngày";
  return format(date, "dd/MM/yyyy", { locale: vi });
}

/**
 * Short date + time: "08/06 14:30"
 */
export function formatShortDateTimeVi(
  value: string | Date | null | undefined,
): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (isNaN(date.getTime())) return "";
  return format(date, "dd/MM HH:mm", { locale: vi });
}

/**
 * Relative time: "3 phút trước", "2 ngày trước"
 */
export function formatRelative(
  value: string | Date | null | undefined,
): string {
  if (!value) return "Chưa cập nhật";
  const date = typeof value === "string" ? new Date(value) : value;
  if (isNaN(date.getTime())) return "Chưa cập nhật";
  return formatDistanceToNow(date, { addSuffix: true, locale: vi });
}

/**
 * Format a date for HTML <input type="date">: "2026-06-08"
 */
export function formatInputDate(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

/**
 * Calculate remaining hold days from a hold-until date.
 * Returns 0 if the hold has expired.
 */
export function getHoldDaysRemaining(holdUntil: string | Date): number {
  const target =
    typeof holdUntil === "string" ? new Date(holdUntil) : holdUntil;
  if (isNaN(target.getTime())) return 0;
  const days = differenceInDays(target, new Date());
  return Math.max(0, days);
}

/**
 * Create a Date that is `days` days from now.
 */
export function addDaysFromNow(days: number): Date {
  return addDays(new Date(), days);
}

/**
 * Get the start date for a price range period.
 */
export function getRangeStartDate(range: PriceRange, now = new Date()): Date {
  switch (range) {
    case "7d":
      return subDays(now, 7);
    case "1m":
      return subMonths(now, 1);
    case "3m":
      return subMonths(now, 3);
    case "6m":
      return subMonths(now, 6);
    case "1y":
      return subYears(now, 1);
  }
}
