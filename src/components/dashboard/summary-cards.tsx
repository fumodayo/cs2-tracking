"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import {
  HelpCircle,
  ArrowLeftRight,
  Percent,
  ShoppingBag,
  Layers,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { FadeIn, CountUp } from "@/components/ui/animation";
import { useTranslation } from "react-i18next";
import type { PortfolioTableRow } from "@/components/portfolio";

const RATE_ITEM_TYPES = new Set(["case", "sticker", "capsule"]);

function hasBuff(row: PortfolioTableRow): boolean {
  return (
    row.currentPrice !== null &&
    row.steamPrice !== null &&
    row.steamPrice !== undefined &&
    row.currentPrice !== row.steamPrice
  );
}

function computeRateValue(
  rows: PortfolioTableRow[],
  ratePercent: number,
): number {
  let total = 0;

  for (const r of rows) {
    const value = r.currentValue ?? r.investedValue;

    if (r.itemType === "skin") {
      // Skin with buff price → 100%, skin without buff → apply rate
      total += hasBuff(r) ? value : value * (ratePercent / 100);
    } else if (RATE_ITEM_TYPES.has(r.itemType)) {
      // Case, sticker, capsule → apply rate
      total += value * (ratePercent / 100);
    }
  }

  return total;
}

const LS_KEY_RATE_SI = "cs2t_rateSi";
const LS_KEY_RATE_LE = "cs2t_rateLe";

function readRate(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const saved = localStorage.getItem(key);
  return saved ? Number(saved) || fallback : fallback;
}

interface TitleInputTagProps {
  value: number;
  onChange: (val: number) => void;
  unit: string;
  min?: number;
  max?: number;
  inputClassName?: string;
}

function TitleInputTag({
  value,
  onChange,
  unit,
  min = 0,
  max,
  inputClassName = "text-foreground",
}: TitleInputTagProps) {
  const [localVal, setLocalVal] = useState(String(value));

  useEffect(() => {
    setLocalVal(String(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalVal(raw);
    const num = Number(raw) || 0;
    onChange(num);
  };

  return (
    <div className="flex items-center gap-1 rounded bg-stone-800/40 border border-stone-850 hover:border-stone-700/80 focus-within:border-accent/40 focus-within:bg-stone-850/60 transition-all duration-200 px-1.5 py-0.5 ml-2 cursor-pointer">
      <input
        type="number"
        value={localVal}
        onChange={handleChange}
        min={min}
        max={max}
        className={`w-10 bg-transparent text-center text-xs font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${inputClassName}`}
      />
      <span className="text-[9px] text-muted-foreground font-semibold uppercase">
        {unit}
      </span>
    </div>
  );
}

type SummaryCardsProps = {
  computedRows?: PortfolioTableRow[];
  steamWalletTotal?: number;
  buffCnyToVndRate: number;
  onUpdateBuffRate: (rate: number) => void;
};

export function SummaryCards({
  computedRows = [],
  steamWalletTotal = 0,
  buffCnyToVndRate,
  onUpdateBuffRate,
}: SummaryCardsProps) {
  const { t } = useTranslation();

  const [rateSi, setRateSi] = useState(() => readRate(LS_KEY_RATE_SI, 60));
  const [rateLe, setRateLe] = useState(() => readRate(LS_KEY_RATE_LE, 65));

  useEffect(() => {
    localStorage.setItem(LS_KEY_RATE_SI, String(rateSi));
  }, [rateSi]);

  useEffect(() => {
    localStorage.setItem(LS_KEY_RATE_LE, String(rateLe));
  }, [rateLe]);

  // Calculations
  const valueSi = computeRateValue(computedRows, rateSi);
  const valueLe = computeRateValue(computedRows, rateLe);
  const itemCount = computedRows.reduce((sum, r) => sum + r.quantity, 0);
  const totalCurrentValue = computedRows.reduce(
    (sum, r) => sum + (r.currentValue ?? r.investedValue),
    0,
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* CARD 1: Tỷ giá Buff (CNY/VNĐ) */}
      <FadeIn delay={0.02} direction="up" className="h-full">
        <Card className="h-full border border-emerald-500/10 bg-emerald-950/[0.04] p-4 text-foreground transition-all duration-300 hover:shadow-soft hover:border-emerald-500/20 rounded-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center">
                <span className="text-xs font-semibold tracking-wider text-stone-400 uppercase">
                  {t("rateCards.rateBuffTitle", "Tỷ giá Buff (CNY/VNĐ)")}
                </span>
                <TooltipProvider>
                  <Tooltip
                    content={t(
                      "rateCards.rateBuffTooltip",
                      "Tỷ giá chuyển đổi từ Nhân dân tệ (CNY) sang Việt Nam Đồng (VNĐ) dùng cho định giá hòm và skin từ Buff163.",
                    )}
                    side="top"
                    align="start"
                  >
                    <span className="ml-1 text-stone-500 hover:text-stone-300 transition-colors cursor-help">
                      <HelpCircle className="size-3.5" />
                    </span>
                  </Tooltip>
                </TooltipProvider>
                <TitleInputTag
                  value={buffCnyToVndRate}
                  onChange={onUpdateBuffRate}
                  unit="VNĐ"
                  inputClassName="text-emerald-400"
                />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-400">
                <CountUp to={buffCnyToVndRate} decimals={0} separator="." />
                <span className="text-lg font-semibold ml-0.5"> đ</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t(
                  "rateCards.rateBuffDesc",
                  "Công thức: Giá Buff (CNY) × Tỷ giá",
                )}
              </p>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 transition-colors duration-200">
              <ArrowLeftRight className="size-5" />
            </div>
          </div>
        </Card>
      </FadeIn>

      {/* CARD 2: Tỷ lệ bán sỉ (%) */}
      <FadeIn delay={0.06} direction="up" className="h-full">
        <Card className="h-full border border-blue-500/10 bg-blue-950/[0.04] p-4 text-foreground transition-all duration-300 hover:shadow-soft hover:border-blue-500/20 rounded-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center">
                <span className="text-xs font-semibold tracking-wider text-stone-400 uppercase">
                  {t("rateCards.rateSiTitle", "Tỷ lệ bán sỉ (%)")}
                </span>
                <TooltipProvider>
                  <Tooltip
                    content={t(
                      "rateCards.rateSiTooltip",
                      "Tỷ lệ phần trăm ước tính nhận được khi thanh lý nhanh toàn bộ kho đồ sỉ.",
                    )}
                    side="top"
                    align="start"
                  >
                    <span className="ml-1 text-stone-500 hover:text-stone-300 transition-colors cursor-help">
                      <HelpCircle className="size-3.5" />
                    </span>
                  </Tooltip>
                </TooltipProvider>
                <TitleInputTag
                  value={rateSi}
                  onChange={setRateSi}
                  unit="%"
                  max={100}
                  inputClassName="text-blue-400"
                />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-blue-400">
                <CountUp to={valueSi} decimals={0} separator="." />
                <span className="text-lg font-semibold ml-0.5"> đ</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t(
                  "rateCards.rateSiDesc",
                  "Ước tính thu về khi thanh lý toàn bộ",
                )}
              </p>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 transition-colors duration-200">
              <Percent className="size-5" />
            </div>
          </div>
        </Card>
      </FadeIn>

      {/* CARD 3: Tỷ lệ bán lẻ (%) */}
      <FadeIn delay={0.1} direction="up" className="h-full">
        <Card className="h-full border border-amber-500/10 bg-amber-950/[0.04] p-4 text-foreground transition-all duration-300 hover:shadow-soft hover:border-amber-500/20 rounded-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center">
                <span className="text-xs font-semibold tracking-wider text-stone-400 uppercase">
                  {t("rateCards.rateLeTitle", "Tỷ lệ bán lẻ (%)")}
                </span>
                <TooltipProvider>
                  <Tooltip
                    content={t(
                      "rateCards.rateLeTooltip",
                      "Tỷ lệ phần trăm ước tính nhận được khi bán lẻ từng vật phẩm trên thị trường.",
                    )}
                    side="top"
                    align="start"
                  >
                    <span className="ml-1 text-stone-500 hover:text-stone-300 transition-colors cursor-help">
                      <HelpCircle className="size-3.5" />
                    </span>
                  </Tooltip>
                </TooltipProvider>
                <TitleInputTag
                  value={rateLe}
                  onChange={setRateLe}
                  unit="%"
                  max={100}
                  inputClassName="text-amber-500 dark:text-amber-400"
                />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-amber-500 dark:text-amber-400">
                <CountUp to={valueLe} decimals={0} separator="." />
                <span className="text-lg font-semibold ml-0.5"> đ</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t(
                  "rateCards.rateLeDesc",
                  "Ước tính thu về khi bán từng vật phẩm",
                )}
              </p>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 transition-colors duration-200">
              <ShoppingBag className="size-5" />
            </div>
          </div>
        </Card>
      </FadeIn>

      {/* CARD 4: Vật phẩm đang định giá */}
      <FadeIn delay={0.14} direction="up" className="h-full">
        <Card className="h-full border border-indigo-500/10 bg-indigo-950/[0.04] p-4 text-foreground transition-all duration-300 hover:shadow-soft hover:border-indigo-500/20 rounded-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center">
                <span className="text-xs font-semibold tracking-wider text-stone-400 uppercase">
                  {t("rateCards.itemsPricedTitle", "Vật phẩm đang định giá")}
                </span>
                <TooltipProvider>
                  <Tooltip
                    content={t(
                      "rateCards.itemsPricedTooltip",
                      "Tổng số lượng vật phẩm đang được định giá trong hệ thống của bạn.",
                    )}
                    side="top"
                    align="start"
                  >
                    <span className="ml-1 text-stone-500 hover:text-stone-300 transition-colors cursor-help">
                      <HelpCircle className="size-3.5" />
                    </span>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-blue-400">
                <CountUp to={itemCount} decimals={0} separator="." />
                <span className="text-sm font-normal text-muted-foreground ml-1.5">
                  vật phẩm
                </span>
              </p>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 transition-colors duration-200">
              <Layers className="size-5" />
            </div>
          </div>
        </Card>
      </FadeIn>

      {/* CARD 5: Tổng giá trị thị trường (100%) */}
      <FadeIn delay={0.18} direction="up" className="h-full">
        <Card className="h-full border border-emerald-500/10 bg-emerald-950/[0.04] p-4 text-foreground transition-all duration-300 hover:shadow-soft hover:border-emerald-500/20 rounded-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center">
                <span className="text-xs font-semibold tracking-wider text-stone-400 uppercase">
                  {t(
                    "rateCards.marketValueTitle",
                    "Tổng giá trị thị trường (100%)",
                  )}
                </span>
                <TooltipProvider>
                  <Tooltip
                    content={t(
                      "rateCards.marketValueTooltip",
                      "Tổng giá trị của tất cả vật phẩm theo đơn giá thị trường 100% (không áp dụng chiết khấu).",
                    )}
                    side="top"
                    align="start"
                  >
                    <span className="ml-1 text-stone-500 hover:text-stone-300 transition-colors cursor-help">
                      <HelpCircle className="size-3.5" />
                    </span>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-400">
                <CountUp to={totalCurrentValue} decimals={0} separator="." />
                <span className="text-lg font-semibold ml-0.5"> đ</span>
              </p>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 transition-colors duration-200">
              <TrendingUp className="size-5" />
            </div>
          </div>
        </Card>
      </FadeIn>

      {/* CARD 6: Số dư ví Steam */}
      <FadeIn delay={0.22} direction="up" className="h-full">
        <Card className="h-full border border-cyan-500/10 bg-cyan-950/[0.04] p-4 text-foreground transition-all duration-300 hover:shadow-soft hover:border-cyan-500/20 rounded-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center">
                <span className="text-xs font-semibold tracking-wider text-stone-400 uppercase">
                  {t("rateCards.steamWalletTitle", "Số dư ví Steam")}
                </span>
                <TooltipProvider>
                  <Tooltip
                    content={t(
                      "rateCards.steamWalletTooltip",
                      "Tổng số dư ví Steam hiện tại của tất cả các tài khoản được liên kết.",
                    )}
                    side="top"
                    align="start"
                  >
                    <span className="ml-1 text-stone-500 hover:text-stone-300 transition-colors cursor-help">
                      <HelpCircle className="size-3.5" />
                    </span>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-sky-450 dark:text-sky-400">
                <CountUp to={steamWalletTotal} decimals={0} separator="." />
                <span className="text-lg font-semibold ml-0.5"> đ</span>
              </p>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 transition-colors duration-200">
              <Wallet className="size-5" />
            </div>
          </div>
        </Card>
      </FadeIn>
    </div>
  );
}
