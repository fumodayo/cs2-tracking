import { describe, expect, it } from 'vitest';
import { calculateLotTotal } from './item-price-section-values';

describe('calculateLotTotal', () => {
  it('multiplies the unit buy price by quantity', () => {
    expect(calculateLotTotal('2', '360.000')).toBe(720_000);
  });

  it('supports an already parsed unit price', () => {
    expect(calculateLotTotal('3', 125_000)).toBe(375_000);
  });

  it('rejects invalid quantity or price values', () => {
    expect(calculateLotTotal('0', '360.000')).toBeNull();
    expect(calculateLotTotal('2', 'invalid')).toBeNull();
  });
});
