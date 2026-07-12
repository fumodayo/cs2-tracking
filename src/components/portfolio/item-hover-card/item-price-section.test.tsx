// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PortfolioTableRow } from '../portfolio-table-model';
import { ItemPriceSection } from './item-price-section';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

afterEach(() => {
  document.body.innerHTML = '';
});

const item = { sourceType: 'manual' } as PortfolioTableRow;
const noop = () => undefined;

function renderPriceSection(hasBuff: boolean) {
  return render(
    <ItemPriceSection
      item={item}
      quantity="2"
      setQuantity={noop}
      priceCny="327.157"
      updateCny={noop}
      buyRate="110"
      updateBuyRate={noop}
      sellRate="3.600"
      updateSellRate={noop}
      note="Manual"
      setNote={noop}
      priceVnd="360.000"
      updateVnd={noop}
      submit={noop}
      hasBuff={hasBuff}
    />
  );
}

describe('ItemPriceSection', () => {
  it('hides the percentage input and makes Market price read-only without BUFF', () => {
    renderPriceSection(false);

    expect(screen.queryByLabelText('Rate Percent')).toBeNull();
    expect(screen.getByLabelText('Market Price VND').hasAttribute('readonly')).toBe(true);
    expect(screen.getByText(/Tổng vốn/).textContent).toContain('720.000');
  });

  it('keeps the CNY/VND exchange-rate input for BUFF items', () => {
    renderPriceSection(true);

    expect(screen.getByLabelText('Buy Rate')).not.toBeNull();
    expect(screen.getByLabelText('CNY Price').hasAttribute('readonly')).toBe(false);
  });
});
