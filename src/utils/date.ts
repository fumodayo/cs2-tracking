import {
  format,
  formatDistanceToNow,
  differenceInDays,
  addDays,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import type { PriceRange } from '@/domain/price';
import i18n from 'i18next';

/**
 * Get current date-fns locale based on i18n active language
 */
function getLocale() {
  return i18n.language === 'en' ? enUS : vi;
}

/**
 * Format a date for display: "08/06/2026 14:30"
 */
export function formatDateTimeVi(value: string | Date | null | undefined): string {
  if (!value) return i18n.t('common.notUpdated') || 'Not updated';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return i18n.t('common.notUpdated') || 'Not updated';
  return format(date, 'dd/MM/yyyy HH:mm', { locale: getLocale() });
}

/**
 * Format a date for display (date only): "08/06/2026"
 */
export function formatDateVi(value: string | Date | null | undefined): string {
  if (!value) return i18n.t('common.unknownDate') || 'Unknown date';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return i18n.t('common.unknownDate') || 'Unknown date';
  return format(date, 'dd/MM/yyyy', { locale: getLocale() });
}

/**
 * Short date + time: "08/06 14:30"
 */
export function formatShortDateTimeVi(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '';
  return format(date, 'dd/MM HH:mm', { locale: getLocale() });
}

/**
 * Relative time: "3 phút trước", "2 ngày trước"
 */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return i18n.t('common.notUpdated');
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return i18n.t('common.notUpdated');
  return formatDistanceToNow(date, { addSuffix: true, locale: getLocale() });
}

/**
 * Format a date for HTML <input type="date">: "2026-06-08"
 */
export function formatInputDate(value: Date): string {
  return format(value, 'yyyy-MM-dd');
}

/**
 * Calculate remaining hold days from a hold-until date.
 * Returns 0 if the hold has expired.
 */
export function getHoldDaysRemaining(holdUntil: string | Date): number {
  const target = typeof holdUntil === 'string' ? new Date(holdUntil) : holdUntil;
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
    case '7d':
      return subDays(now, 7);
    case '1m':
      return subMonths(now, 1);
    case '3m':
      return subMonths(now, 3);
    case '6m':
      return subMonths(now, 6);
    case '1y':
      return subYears(now, 1);
  }
}

/**
 * Get Steam reset hour in Vietnam time (UTC+7) for a given date.
 * Midnight Seattle time is:
 * - 14:00 VN time during Daylight Saving Time (PDT)
 * - 15:00 VN time during Standard Time (PST)
 */
export function getSteamResetHour(date: Date): number {
  try {
    const seattleStr = date.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const match = seattleStr.match(/(\d{2})\/(\d{2})\/(\d{4}),\s+(\d{2}):(\d{2}):(\d{2})/);
    if (match) {
      const [, month, day, year, hour, minute, second] = match;
      const seattleLocal = new Date(
        Date.UTC(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second)
        )
      );
      const diffMs = seattleLocal.getTime() - date.getTime();
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      return 7 - diffHours;
    }
  } catch (e) {
    console.error('Failed to detect Seattle timezone offset:', e);
  }
  const month = date.getMonth();
  if (month > 2 && month < 10) {
    return 14;
  }
  return 15;
}

/**
 * Calculate the exact unlock timestamp for a trade hold based on buyDate and holdDays,
 * rounding to the next Seattle daily reset if the duration runs past the reset time.
 */
export function calculateTradeHoldUntil(buyDate: Date, holdDays: number): Date {
  const baseUnlockDate = new Date(buyDate.getTime() + holdDays * 24 * 60 * 60 * 1000);
  const resetHour = getSteamResetHour(baseUnlockDate);

  // Create candidate unlock date on the base unlock day at resetHour:00 VN time (UTC+7)
  const unlockTimeVN = new Date(baseUnlockDate);
  unlockTimeVN.setUTCHours(resetHour - 7, 0, 0, 0);

  if (baseUnlockDate.getTime() > unlockTimeVN.getTime()) {
    unlockTimeVN.setUTCDate(unlockTimeVN.getUTCDate() + 1);
    const nextResetHour = getSteamResetHour(unlockTimeVN);
    unlockTimeVN.setUTCHours(nextResetHour - 7, 0, 0, 0);
  }

  return unlockTimeVN;
}
