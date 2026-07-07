'use client';

import { Control, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { FormValues } from './types';

interface PricingFormulaSectionProps {
  control: Control<FormValues>;
  handleBuffPriceChange: (val: string) => void;
  handleBuffRateChange: (val: string) => void;
  handleBuyPriceChange: (val: string) => void;
}

export function PricingFormulaSection({
  control,
  handleBuffPriceChange,
  handleBuffRateChange,
  handleBuyPriceChange,
}: PricingFormulaSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
        {/* Buff Price Input */}
        <div className="min-w-0 flex-1">
          <label
            htmlFor="pricing-buff-price"
            className="text-muted-foreground mb-1 block text-[10px] font-semibold"
          >
            {t('portfolio.buffPriceCny', 'Giá Buff (CNY)')}
          </label>
          <Controller
            control={control}
            name="buffPrice"
            render={({ field }) => (
              <Input
                id="pricing-buff-price"
                value={field.value}
                onChange={(e) => handleBuffPriceChange(e.target.value)}
                placeholder="VD: 3,5"
                className="h-10 text-sm"
              />
            )}
          />
        </div>

        {/* Multiplication Sign */}
        <div className="text-muted-foreground/60 hidden items-center justify-center px-1 pb-2.5 text-sm font-black select-none sm:flex">
          ×
        </div>
        <div className="text-muted-foreground/60 text-center text-xs font-black select-none sm:hidden">
          {t('portfolio.multipliedByRate', 'nhân với')}
        </div>

        {/* Exchange Rate Input */}
        <div className="min-w-0 flex-1">
          <label
            htmlFor="pricing-buff-rate"
            className="text-muted-foreground mb-1 block text-[10px] font-semibold"
          >
            {t('portfolio.buffRate', 'Tỷ giá')}
          </label>
          <Controller
            control={control}
            name="buffRate"
            render={({ field }) => (
              <Input
                id="pricing-buff-rate"
                value={field.value}
                onChange={(e) => handleBuffRateChange(e.target.value)}
                placeholder="VD: 3.600"
                className="h-10 text-sm"
              />
            )}
          />
        </div>

        {/* Equals Sign */}
        <div className="text-muted-foreground/60 hidden items-center justify-center px-1 pb-2.5 text-sm font-black select-none sm:flex">
          =
        </div>
        <div className="text-muted-foreground/60 text-center text-xs font-black select-none sm:hidden">
          {t('portfolio.equalsVnd', 'bằng (VND)')}
        </div>

        {/* Final Buy Price Input */}
        <div className="min-w-0 flex-[1.2]">
          <label
            htmlFor="pricing-buy-price"
            className="text-accent mb-1 block text-[10px] font-bold"
          >
            {t('portfolio.buyPricePerCaseVnd', 'Giá mua (VND)')}
          </label>
          <Controller
            control={control}
            name="buyPrice"
            render={({ field }) => (
              <Input
                id="pricing-buy-price"
                value={field.value}
                onChange={(e) => handleBuyPriceChange(e.target.value)}
                inputMode="numeric"
                placeholder="VD: 12.500"
                className="text-accent focus:border-accent/80 focus:ring-accent/30 h-10 text-sm font-bold focus:ring-1"
              />
            )}
          />
        </div>
      </div>
    </div>
  );
}
