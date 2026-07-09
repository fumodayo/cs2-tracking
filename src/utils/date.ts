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
 * Lấy locale date-fns hiện tại theo ngôn ngữ active của i18n
 */
function getLocale() {
  return i18n.language === 'en' ? enUS : vi;
}

/**
 * Định dạng ngày giờ để hiển thị: "08/06/2026 14:30"
 */
export function formatDateTimeVi(value: string | Date | null | undefined): string {
  if (!value) return i18n.t('common.notUpdated') || 'Not updated';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return i18n.t('common.notUpdated') || 'Not updated';
  return format(date, 'dd/MM/yyyy HH:mm', { locale: getLocale() });
}

/**
 * Định dạng ngày để hiển thị, chỉ ngày: "08/06/2026"
 */
export function formatDateVi(value: string | Date | null | undefined): string {
  if (!value) return i18n.t('common.unknownDate') || 'Unknown date';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return i18n.t('common.unknownDate') || 'Unknown date';
  return format(date, 'dd/MM/yyyy', { locale: getLocale() });
}

/**
 * Ngày giờ dạng ngắn: "08/06 14:30"
 */
export function formatShortDateTimeVi(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '';
  return format(date, 'dd/MM HH:mm', { locale: getLocale() });
}

/**
 * Thời gian tương đối: "3 phút trước", "2 ngày trước"
 */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return i18n.t('common.notUpdated');
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return i18n.t('common.notUpdated');
  return formatDistanceToNow(date, { addSuffix: true, locale: getLocale() });
}

/**
 * Định dạng ngày cho HTML <input type="date">: "2026-06-08"
 */
export function formatInputDate(value: Date): string {
  return format(value, 'yyyy-MM-dd');
}

/**
 *
 * Tính số ngày hold còn lại từ ngày hold-until.
 * Trả về 0 nếu hold đã hết hạn.
 *
 */
export function getHoldDaysRemaining(holdUntil: string | Date): number {
  const target = typeof holdUntil === 'string' ? new Date(holdUntil) : holdUntil;
  if (isNaN(target.getTime())) return 0;
  const days = differenceInDays(target, new Date());
  return Math.max(0, days);
}

/**
 *
 * Tính số ngày hold còn lại, làm tròn lên ngày lẻ cho trạng thái UI.
 * Trả về 0 khi giá trị rỗng, không hợp lệ hoặc đã hết hạn.
 *
 */
export function getRemainingHoldDays(value: string | Date | null | undefined): number {
  if (!value) return 0;
  const target = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(target.getTime())) return 0;
  const diffMs = target.getTime() - new Date().getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Tạo Date cách hiện tại `days` ngày.
 */
export function addDaysFromNow(days: number): Date {
  return addDays(new Date(), days);
}

/**
 * Lấy ngày bắt đầu cho một khoảng thời gian giá.
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
 *
 * Lấy giờ reset Steam theo giờ Việt Nam (UTC+7) cho một ngày cụ thể.
 * Nửa đêm giờ Seattle tương ứng:
 * - 14:00 giờ VN khi Seattle dùng giờ mùa hè (PDT)
 * - 15:00 giờ VN khi Seattle dùng giờ tiêu chuẩn (PST)
 *
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
 *
 * Tính timestamp mở khóa chính xác cho trade hold dựa trên buyDate và holdDays,
 * làm tròn tới lần reset hằng ngày kế tiếp theo giờ Seattle nếu thời lượng vượt qua giờ reset.
 *
 */
export function calculateTradeHoldUntil(buyDate: Date, holdDays: number): Date {
  const baseUnlockDate = new Date(buyDate.getTime() + holdDays * 24 * 60 * 60 * 1000);
  const resetHour = getSteamResetHour(baseUnlockDate);

  // Tạo ngày mở khóa ứng viên vào ngày mở khóa gốc tại resetHour:00 giờ VN (UTC+7)
  const unlockTimeVN = new Date(baseUnlockDate);
  unlockTimeVN.setUTCHours(resetHour - 7, 0, 0, 0);

  if (baseUnlockDate.getTime() > unlockTimeVN.getTime()) {
    unlockTimeVN.setUTCDate(unlockTimeVN.getUTCDate() + 1);
    const nextResetHour = getSteamResetHour(unlockTimeVN);
    unlockTimeVN.setUTCHours(nextResetHour - 7, 0, 0, 0);
  }

  return unlockTimeVN;
}
