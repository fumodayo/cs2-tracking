'use client';

import { memo, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, Loader2, X } from 'lucide-react';
import { useCurrency } from '@/components/currency-provider';
import type { PortfolioTableRow } from './portfolio-table-model';
import { calculateRatedValue, toInputNumber } from './portfolio-table-utils';

import { Button } from '@/components/ui/button';

export const RatedValueCell = memo(function RatedValueCell({
  item,
  ratePercent,
  label,
}: {
  item: PortfolioTableRow;
  ratePercent: number;
  label: string;
}) {
  const { formatCurrency } = useCurrency();
  const hasBuff =
    item.itemType === 'skin' &&
    item.currentPrice !== null &&
    item.steamPrice !== null &&
    item.steamPrice !== undefined &&
    item.currentPrice !== item.steamPrice;

  if (hasBuff) {
    return <span className="text-muted-foreground">--</span>;
  }

  const value = calculateRatedValue(item, ratePercent);
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-foreground font-semibold">{formatCurrency(value)}</span>
      <span className="bg-surface-muted text-muted-foreground inline-flex items-center gap-1 rounded px-1 py-0.5 text-[9px] font-semibold tracking-wider uppercase">
        {label} <ArrowRight className="size-2.5" /> {toInputNumber(ratePercent)}%
      </span>
    </div>
  );
});
RatedValueCell.displayName = 'RatedValueCell';

export const BuyPriceCell = memo(function BuyPriceCell({
  item,
  buffCnyToVndRate,
  disabled,
  saving,
  onUpdateBuyPrice,
}: {
  item: PortfolioTableRow;
  buffCnyToVndRate: number;
  disabled: boolean;
  saving: boolean;
  onUpdateBuyPrice?: (id: string, buyPrice: number) => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const [editing, setEditing] = useState(false);
  const [priceCny, setPriceCny] = useState(() => toInputNumber(item.buyPrice / buffCnyToVndRate));
  const [rate, setRate] = useState(() => toInputNumber(buffCnyToVndRate));
  const [priceVnd, setPriceVnd] = useState(() => toInputNumber(item.buyPrice));

  function startEditing() {
    if (disabled) return;
    setPriceCny(toInputNumber(item.buyPrice / buffCnyToVndRate));
    setRate(toInputNumber(buffCnyToVndRate));
    setPriceVnd(toInputNumber(item.buyPrice));
    setEditing(true);
  }

  function updateCny(value: string) {
    setPriceCny(value);
    const cny = Number(value);
    const nextRate = Number(rate);
    if (Number.isFinite(cny) && Number.isFinite(nextRate)) {
      setPriceVnd(toInputNumber(Math.round(cny * nextRate)));
    }
  }

  function updateRate(value: string) {
    setRate(value);
    const cny = Number(priceCny);
    const nextRate = Number(value);
    if (Number.isFinite(cny) && Number.isFinite(nextRate)) {
      setPriceVnd(toInputNumber(Math.round(cny * nextRate)));
    }
  }

  function updateVnd(value: string) {
    setPriceVnd(value);
    const vnd = Number(value);
    const nextRate = Number(rate);
    if (Number.isFinite(vnd) && Number.isFinite(nextRate) && nextRate > 0) {
      setPriceCny(toInputNumber(vnd / nextRate));
    }
  }

  async function save() {
    const nextPrice = Math.round(Number(priceVnd));
    if (!Number.isFinite(nextPrice) || nextPrice <= 0 || !onUpdateBuyPrice) return;
    await onUpdateBuyPrice(item.id, nextPrice);
    setEditing(false);
  }

  if (!editing) {
    return (
      <Button
        type="button"
        onDoubleClick={startEditing}
        disabled={disabled}
        className="hover:bg-surface-hover inline-flex min-h-9 flex-col items-end justify-center rounded-md px-2 py-1 text-right transition disabled:cursor-default"
        title={t('portfolio.doubleClickEditCny', 'Double-click to enter CNY × BUFF rate')}
      >
        <span className="text-foreground flex items-center justify-end gap-1 font-medium">
          {formatCurrency(item.buyPrice)}
        </span>
        <span className="text-muted-foreground text-[10px]">
          {t('portfolio.doubleClickToEdit', 'double-click to edit')}
        </span>
      </Button>
    );
  }

  return (
    <div className="border-border bg-surface ml-auto flex min-w-[21rem] flex-col items-end gap-2 rounded-md border p-2 shadow-sm">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <MoneyInput
          ariaLabel={t('portfolio.priceCny', 'CNY Price')}
          value={priceCny}
          onChange={updateCny}
          className="w-20"
        />
        <span>×</span>
        <MoneyInput
          ariaLabel={t('portfolio.buyRate', 'Buy Rate')}
          value={rate}
          onChange={updateRate}
          className="w-20"
        />
        <span>=</span>
        <MoneyInput
          ariaLabel={t('portfolio.buyPriceVnd', 'Buy Price VND')}
          value={priceVnd}
          onChange={updateVnd}
          className="w-28"
          autoFocusEnabled
          onEnter={save}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          onClick={() => setEditing(false)}
          className="border-border text-muted-foreground hover:bg-surface-hover inline-grid size-7 place-items-center rounded border"
          aria-label={t('common.cancel', 'Cancel')}
        >
          <X className="size-3.5" />
        </Button>
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="bg-accent text-accent-foreground hover:bg-accent-hover inline-grid size-7 place-items-center rounded disabled:cursor-wait disabled:opacity-60"
          aria-label={t('portfolio.saveBuyPrice', 'Save buy price')}
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        </Button>
      </div>
    </div>
  );
});
BuyPriceCell.displayName = 'BuyPriceCell';

export const MoneyInput = memo(function MoneyInput({
  ariaLabel,
  value,
  onChange,
  onEnter,
  className,
  autoFocusEnabled,
}: {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  className?: string;
  autoFocusEnabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocusEnabled) {
      inputRef.current?.focus();
    }
  }, [autoFocusEnabled]);

  return (
    <input
      ref={inputRef}
      aria-label={ariaLabel}
      type="number"
      min="0"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onEnter?.();
        }
      }}
      className={`border-input-border bg-input text-foreground focus:border-ring h-8 rounded border px-2 text-right text-xs font-semibold outline-none ${className ?? ''}`}
    />
  );
});
MoneyInput.displayName = 'MoneyInput';

export const QuantityCell = memo(function QuantityCell({
  item,
  disabled,
  saving,
  onUpdateQuantity,
}: {
  item: PortfolioTableRow;
  disabled: boolean;
  saving: boolean;
  onUpdateQuantity?: (id: string, quantity: number) => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(() => String(item.quantity));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  function startEditing() {
    if (disabled) return;
    setQuantity(String(item.quantity));
    setEditing(true);
  }

  async function save() {
    const nextQuantity = Math.round(Number(quantity));
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0 || !onUpdateQuantity) return;
    await onUpdateQuantity(item.id, nextQuantity);
    setEditing(false);
  }

  if (!editing) {
    return (
      <Button
        type="button"
        onDoubleClick={startEditing}
        disabled={disabled}
        title={
          disabled ? undefined : t('portfolio.doubleClickEditQty', 'Double-click to edit quantity')
        }
        className="group hover:border-border hover:bg-surface-muted relative inline-flex min-w-16 items-center justify-end rounded border border-transparent px-1.5 py-1 text-right font-medium disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:bg-transparent"
      >
        <span className="text-foreground">{item.quantity}</span>
        {saving && (
          <div className="bg-surface-muted/80 absolute inset-0 flex items-center justify-center rounded backdrop-blur-sm">
            <Loader2 className="text-accent size-3 animate-spin" />
          </div>
        )}
      </Button>
    );
  }

  return (
    <div className="inline-flex min-w-16 flex-col items-end gap-1.5">
      <input
        ref={inputRef}
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
          if (e.key === 'Escape') setEditing(false);
        }}
        min={1}
        className="border-ring bg-input text-foreground w-16 [appearance:textfield] rounded border px-1.5 py-1 text-right text-sm font-medium outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="flex items-center gap-1">
        <Button
          type="button"
          onClick={() => setEditing(false)}
          className="border-border bg-surface-muted text-muted-foreground hover:bg-surface-hover hover:text-foreground inline-flex size-5 items-center justify-center rounded border"
        >
          <X className="size-3" />
        </Button>
        <Button
          type="button"
          onClick={() => void save()}
          className="border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 inline-flex size-5 items-center justify-center rounded border"
        >
          <Check className="size-3" />
        </Button>
      </div>
    </div>
  );
});
QuantityCell.displayName = 'QuantityCell';
