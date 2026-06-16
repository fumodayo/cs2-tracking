import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPercent, formatVND } from '../format';
import {
  formatDateTimeVi,
  formatDateVi,
  formatShortDateTimeVi,
  formatInputDate,
  getHoldDaysRemaining,
} from '../date';

describe('format.ts tests', () => {
  it('should format currency properly', () => {
    // Replace non-breaking space / special characters with clean spaces for comparison if needed,
    // or use direct regex/contain check due to varying OS-specific new Intl.NumberFormat results.
    expect(formatCurrency(null)).toBe('Chưa có');
    expect(formatCurrency(undefined)).toBe('Chưa có');
    expect(formatCurrency(NaN)).toBe('Chưa có');

    const formatted = formatCurrency(15000);
    expect(formatted).toContain('15.000');
    expect(formatted).toContain('₫');
  });

  it('should format percentage properly', () => {
    expect(formatPercent(null)).toBe('--');
    expect(formatPercent(undefined)).toBe('--');
    expect(formatPercent(15.234)).toBe('+15.23%');
    expect(formatPercent(-5.1)).toBe('-5.10%');
    expect(formatPercent(0)).toBe('0.00%');
  });

  it('should format VND properly', () => {
    const formatted = formatVND(5000);
    expect(formatted).toContain('5.000');
    expect(formatted).toContain('₫');
  });
});

describe('date.ts tests', () => {
  it('should format date time properly', () => {
    expect(formatDateTimeVi(null)).toBe('Chưa cập nhật');
    expect(formatDateTimeVi(new Date('invalid-date'))).toBe('Chưa cập nhật');

    const dateStr = '2026-06-08T14:30:00Z';
    const formatted = formatDateTimeVi(dateStr);
    expect(formatted).toContain('08/06/2026');
  });

  it('should format date only properly', () => {
    expect(formatDateVi(null)).toBe('Chưa rõ ngày');
    expect(formatDateVi('2026-06-08')).toBe('08/06/2026');
  });

  it('should format short date time properly', () => {
    expect(formatShortDateTimeVi(null)).toBe('');
    expect(formatShortDateTimeVi('2026-06-08T14:30:00Z')).toContain('08/06');
  });

  it('should calculate remaining hold days', () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(getHoldDaysRemaining(pastDate)).toBe(0);

    const futureDate = new Date(Date.now() + 2.5 * 24 * 60 * 60 * 1000);
    expect(getHoldDaysRemaining(futureDate)).toBeGreaterThanOrEqual(2);
  });

  it('should format input date properly', () => {
    const date = new Date(2026, 5, 8); // June 8th (month is 0-indexed)
    expect(formatInputDate(date)).toBe('2026-06-08');
  });
});
