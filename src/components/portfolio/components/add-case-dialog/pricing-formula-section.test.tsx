// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { PricingFormulaSection } from './pricing-formula-section';
import type { FormValues } from './types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

function PricingHarness({ hasBuff }: { hasBuff: boolean }) {
  const { control } = useForm<FormValues>({
    defaultValues: {
      quantity: '1',
      buyPrice: '360.000',
      buyDate: '2026-07-12',
      buffPrice: '100',
      buffRate: '3.600',
      accountId: '',
      storageUnitId: '',
      itemState: 'tradeable',
      holdDays: '',
    },
  });

  return (
    <PricingFormulaSection
      control={control}
      hasBuff={hasBuff}
      marketPrice="327.157"
      handleBuffPriceChange={vi.fn()}
      handleBuffRateChange={vi.fn()}
      handleBuyPriceChange={vi.fn()}
    />
  );
}

describe('PricingFormulaSection', () => {
  it('shows the 100% Market reference without BUFF conversion inputs', () => {
    render(<PricingHarness hasBuff={false} />);

    expect(screen.getByLabelText('Giá Market (100%)').hasAttribute('readonly')).toBe(true);
    expect(screen.getByLabelText('Đơn giá mua (VND)')).not.toBeNull();
    expect(screen.queryByLabelText('Giá Buff (CNY)')).toBeNull();
  });

  it('keeps BUFF price and exchange-rate inputs for BUFF items', () => {
    render(<PricingHarness hasBuff />);

    expect(screen.getByLabelText('Giá Buff (CNY)')).not.toBeNull();
    expect(screen.getByLabelText('Tỷ giá')).not.toBeNull();
    expect(screen.queryByLabelText('Giá Market (100%)')).toBeNull();
  });
});
