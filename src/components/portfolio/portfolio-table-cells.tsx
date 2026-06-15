"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { useCurrency } from "@/components/currency-provider";
import type { PortfolioTableRow } from "./portfolio-table-model";
import { calculateRatedValue, toInputNumber } from "./portfolio-table-utils";

import { Button } from "@/components/ui/button";
export function RatedValueCell({
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
    item.itemType === "skin" &&
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
      <span className="font-semibold text-foreground">
        {formatCurrency(value)}
      </span>
      <span className="inline-flex items-center gap-1 rounded bg-surface-muted px-1 py-0.5 text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label} <ArrowRight className="size-2.5" /> {toInputNumber(ratePercent)}
        %
      </span>
    </div>
  );
}

export function BuyPriceCell({
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
  const { formatCurrency } = useCurrency();
  const [editing, setEditing] = useState(false);
  const [priceCny, setPriceCny] = useState(() =>
    toInputNumber(item.buyPrice / buffCnyToVndRate),
  );
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
    if (!Number.isFinite(nextPrice) || nextPrice <= 0 || !onUpdateBuyPrice)
      return;
    await onUpdateBuyPrice(item.id, nextPrice);
    setEditing(false);
  }

  if (!editing) {
    return (
      <Button
        type="button"
        onDoubleClick={startEditing}
        disabled={disabled}
        className="inline-flex min-h-9 flex-col items-end justify-center rounded-md px-2 py-1 text-right transition hover:bg-surface-hover disabled:cursor-default"
        title="Double-click để nhập theo CNY x tỷ giá BUFF"
      >
        <span className="flex items-center justify-end gap-1 font-medium text-foreground">
          {formatCurrency(item.buyPrice)}
          {item.isTemporaryPrice && (
            <span
              className="inline-block size-1.5 shrink-0 animate-pulse rounded-full bg-amber-500"
              title="Giá mua tạm tính theo Steam Market (Tự động sync)."
            />
          )}
        </span>
        {item.isTemporaryPrice ? (
          <span className="text-[8px] font-semibold text-amber-500 select-none">
            Tạm tính (Double-click sửa)
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">
            double-click để sửa
          </span>
        )}
      </Button>
    );
  }

  return (
    <div className="ml-auto flex min-w-[21rem] flex-col items-end gap-2 rounded-md border border-border bg-surface p-2 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MoneyInput
          ariaLabel="Giá CNY"
          value={priceCny}
          onChange={updateCny}
          className="w-20"
        />
        <span>×</span>
        <MoneyInput
          ariaLabel="Tỷ giá CNY"
          value={rate}
          onChange={updateRate}
          className="w-20"
        />
        <span>=</span>
        <MoneyInput
          ariaLabel="Giá VND"
          value={priceVnd}
          onChange={updateVnd}
          className="w-28"
          autoFocus
          onEnter={save}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          onClick={() => setEditing(false)}
          className="inline-grid size-7 place-items-center rounded border border-border text-muted-foreground hover:bg-surface-hover"
          aria-label="Hủy"
        >
          <X className="size-3.5" />
        </Button>
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-grid size-7 place-items-center rounded bg-accent text-accent-foreground hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60"
          aria-label="Lưu giá mua"
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

export function MoneyInput({
  ariaLabel,
  value,
  onChange,
  onEnter,
  className,
  autoFocus,
}: {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      aria-label={ariaLabel}
      type="number"
      min="0"
      value={value}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onEnter?.();
        }
      }}
      className={`h-8 rounded border border-input-border bg-input px-2 text-right text-xs font-semibold text-foreground outline-none focus:border-ring ${className ?? ""}`}
    />
  );
}

export function QuantityCell({
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
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(() => String(item.quantity));

  function startEditing() {
    if (disabled) return;
    setQuantity(String(item.quantity));
    setEditing(true);
  }

  async function save() {
    const nextQuantity = Math.round(Number(quantity));
    if (
      !Number.isFinite(nextQuantity) ||
      nextQuantity <= 0 ||
      !onUpdateQuantity
    )
      return;
    await onUpdateQuantity(item.id, nextQuantity);
    setEditing(false);
  }

  if (!editing) {
    return (
      <Button
        type="button"
        onDoubleClick={startEditing}
        disabled={disabled}
        title={disabled ? undefined : "Nháy đúp để sửa số lượng"}
        className="group relative inline-flex min-w-16 items-center justify-end rounded border border-transparent px-1.5 py-1 text-right font-medium hover:border-border hover:bg-surface-muted disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:bg-transparent"
      >
        <span className="text-foreground">{item.quantity}</span>
        {saving && (
          <div className="absolute inset-0 flex items-center justify-center rounded bg-surface-muted/80 backdrop-blur-sm">
            <Loader2 className="size-3 animate-spin text-accent" />
          </div>
        )}
      </Button>
    );
  }

  return (
    <div className="inline-flex min-w-16 flex-col items-end gap-1.5">
      <input
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
          if (e.key === "Escape") setEditing(false);
        }}
        autoFocus
        min={1}
        className="w-16 [appearance:textfield] rounded border border-ring bg-input px-1.5 py-1 text-right text-sm font-medium text-foreground outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="flex items-center gap-1">
        <Button
          type="button"
          onClick={() => setEditing(false)}
          className="inline-flex size-5 items-center justify-center rounded border border-border bg-surface-muted text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          <X className="size-3" />
        </Button>
        <Button
          type="button"
          onClick={() => void save()}
          className="inline-flex size-5 items-center justify-center rounded border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20"
        >
          <Check className="size-3" />
        </Button>
      </div>
    </div>
  );
}
