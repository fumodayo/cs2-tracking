import { describe, expect, it } from 'vitest';
import type { PortfolioTableRow } from '../portfolio-table-model';
import {
  getItemHoverCardDefaultFormValues,
  getItemHoverCardDraftFormValues,
} from './item-hover-card-form-values';

const nonBuffItem = {
  id: 'manual-item',
  quantity: 2,
  buyPrice: 360_000,
  currentPrice: 327_157,
  steamPrice: 327_157,
  sourceAccounts: [],
  sourceType: 'manual',
} as unknown as PortfolioTableRow;

describe('item hover-card form values', () => {
  it('uses a fixed 100% market rate for non-BUFF items', () => {
    const values = getItemHoverCardDefaultFormValues({
      item: nonBuffItem,
      hasBuff: false,
    });

    expect(values.buyRate).toBe('100');
    expect(values.priceCny).toBe('327.157');
    expect(values.priceVnd).toBe('360.000');
  });

  it('ignores legacy derived-rate and Market-price drafts for non-BUFF items', () => {
    const values = getItemHoverCardDraftFormValues({
      item: nonBuffItem,
      hasBuff: false,
      draft: {
        buyRate: '110',
        priceCny: '999.999',
        priceVnd: '360.000',
      },
    });

    expect(values.buyRate).toBe('100');
    expect(values.priceCny).toBe('327.157');
    expect(values.priceVnd).toBe('360.000');
  });

  it('keeps the exchange rate for BUFF items', () => {
    const values = getItemHoverCardDefaultFormValues({
      item: nonBuffItem,
      hasBuff: true,
      buffCnyToVndRate: 3_600,
    });

    expect(values.buyRate).toBe('3.600');
  });
});
