'use client';

import { Control, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { FormValues } from './types';

interface PricingFormulaSectionProps {
  control: Control<FormValues>;
  hasBuff: boolean;
  marketPrice: string;
  handleBuffPriceChange: (val: string) => void;
  handleBuffRateChange: (val: string) => void;
  handleBuyPriceChange: (val: string) => void;
}

export function PricingFormulaSection({
  control,
  hasBuff,
  marketPrice,
  handleBuffPriceChange,
  handleBuffRateChange,
  handleBuyPriceChange,
}: PricingFormulaSectionProps) {
  const { t } = useTranslation();

  if (!hasBuff) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="pricing-market-price"
            className="text-muted-foreground mb-1 block text-[10px] font-semibold"
          >
            {t('portfolio.marketPriceAtFullRate', 'Giá Market (100%)')}
          </label>
          <Input
            id="pricing-market-price"
            value={marketPrice}
            readOnly
            aria-readonly="true"
            className="h-10 cursor-default bg-stone-900/40 text-sm text-stone-400"
          />
        </div>

        <div>
          <label
            htmlFor="pricing-buy-price"
            className="text-accent mb-1 block text-[10px] font-bold"
          >
            {t('portfolio.unitBuyPriceVnd', 'Đơn giá mua (VND)')}
          </label>
          <Controller
            control={control}
            name="buyPrice"
            render={({ field }) => (
              <Input
                id="pricing-buy-price"
                value={field.value}
                onChange={(event) => handleBuyPriceChange(event.target.value)}
                inputMode="numeric"
                placeholder="VD: 12.500"
                className="text-accent focus:border-accent/80 focus:ring-accent/30 h-10 text-sm font-bold focus:ring-1"
              />
            )}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
        {/* Ô nhập giá Buff */}
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

        {/* Dấu nhân */}
        <div className="text-muted-foreground/60 hidden items-center justify-center px-1 pb-2.5 text-sm font-black select-none sm:flex">
          ×
        </div>
        <div className="text-muted-foreground/60 text-center text-xs font-black select-none sm:hidden">
          {t('portfolio.multipliedByRate', 'nhân với')}
        </div>

        {/* Ô nhập tỷ giá */}
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

        {/* Dấu bằng */}
        <div className="text-muted-foreground/60 hidden items-center justify-center px-1 pb-2.5 text-sm font-black select-none sm:flex">
          =
        </div>
        <div className="text-muted-foreground/60 text-center text-xs font-black select-none sm:hidden">
          {t('portfolio.equalsVnd', 'bằng (VND)')}
        </div>

        {/* Ô nhập giá mua cuối */}
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
