'use client';

import { useState, useEffect } from 'react';
import { FadeIn } from '@/components/ui/animation';
import { useTranslation } from 'react-i18next';
import type { PortfolioTableRow } from '@/components/portfolio';
import { BuffRateCard } from '@/components/inventory-scanner/buff-rate-card';
import { RateCard } from '@/components/inventory-scanner/rate-card';
import { StatCard } from '@/components/ui/stat-card';
import { formatVND } from '@/components/inventory-scanner/utils';

const RATE_ITEM_TYPES = new Set(['case', 'sticker', 'capsule']);

function hasBuff(row: PortfolioTableRow): boolean {
  return (
    row.currentPrice !== null &&
    row.steamPrice !== null &&
    row.steamPrice !== undefined &&
    row.currentPrice !== row.steamPrice
  );
}

function computeRateValue(rows: PortfolioTableRow[], ratePercent: number): number {
  let total = 0;

  for (const r of rows) {
    const value = r.currentValue ?? r.investedValue;

    if (r.itemType === 'skin') {
      // Skin có giá Buff → 100%, skin không có Buff → áp rate
      total += hasBuff(r) ? value : value * (ratePercent / 100);
    } else if (RATE_ITEM_TYPES.has(r.itemType)) {
      // Case, sticker, capsule → áp rate
      total += value * (ratePercent / 100);
    }
  }

  return total;
}

const LS_KEY_RATE_SI = 'cs2t_rateSi';
const LS_KEY_RATE_LE = 'cs2t_rateLe';

function readRate(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const saved = localStorage.getItem(key);
  return saved ? Number(saved) || fallback : fallback;
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

  // Các phép tính
  const valueSi = computeRateValue(computedRows, rateSi);
  const valueLe = computeRateValue(computedRows, rateLe);
  const itemCount = computedRows.reduce((sum, r) => sum + r.quantity, 0);
  const totalCurrentValue = computedRows.reduce(
    (sum, r) => sum + (r.currentValue ?? r.investedValue),
    0
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* CARD 1: Tỷ giá Buff (CNY/VNĐ) */}
      <FadeIn delay={0.02} direction="up" className="h-full">
        <BuffRateCard
          value={buffCnyToVndRate}
          onChange={onUpdateBuffRate}
          className="h-full"
          tooltip={
            <span>
              {t(
                'rateCards.rateBuffTooltip',
                'Tỷ giá chuyển đổi từ Nhân dân tệ (CNY) sang Việt Nam Đồng (VNĐ) dùng cho định giá hòm và skin từ Buff163.'
              )}
            </span>
          }
        />
      </FadeIn>

      {/* CARD 2: Tỷ lệ bán sỉ (%) */}
      <FadeIn delay={0.06} direction="up" className="h-full">
        <RateCard
          id="rateSi"
          label={t('rateCards.rateSiTitle', 'Tỷ lệ bán sỉ (%)')}
          value={rateSi}
          onChange={setRateSi}
          total={totalCurrentValue}
          color="blue"
          desc={t('rateCards.rateSiDesc', 'Ước tính thu về khi thanh lý toàn bộ')}
          customCalculatedTotal={valueSi}
          className="h-full"
          tooltip={
            <span>
              {t(
                'rateCards.rateSiTooltip',
                'Tỷ lệ phần trăm ước tính nhận được khi thanh lý nhanh toàn bộ kho đồ sỉ.'
              )}
            </span>
          }
        />
      </FadeIn>

      {/* CARD 3: Tỷ lệ bán lẻ (%) */}
      <FadeIn delay={0.1} direction="up" className="h-full">
        <RateCard
          id="rateLe"
          label={t('rateCards.rateLeTitle', 'Tỷ lệ bán lẻ (%)')}
          value={rateLe}
          onChange={setRateLe}
          total={totalCurrentValue}
          color="amber"
          desc={t('rateCards.rateLeDesc', 'Ước tính thu về khi bán từng vật phẩm')}
          customCalculatedTotal={valueLe}
          className="h-full"
          tooltip={
            <span>
              {t(
                'rateCards.rateLeTooltip',
                'Tỷ lệ phần trăm ước tính nhận được khi bán lẻ từng vật phẩm trên thị trường.'
              )}
            </span>
          }
        />
      </FadeIn>

      {/* CARD 4: Vật phẩm đang định giá */}
      <FadeIn delay={0.14} direction="up" className="h-full">
        <StatCard
          label={t('rateCards.itemsPricedTitle', 'Vật phẩm đang định giá')}
          value={String(itemCount)}
          unit={t('inventoryScanner.itemUnit', 'vật phẩm')}
          variant="blue"
          tooltip={
            <span>
              {t(
                'rateCards.itemsPricedTooltip',
                'Tổng số lượng vật phẩm đang được định giá trong hệ thống của bạn.'
              )}
            </span>
          }
        />
      </FadeIn>

      {/* CARD 5: Tổng giá trị thị trường (100%) */}
      <FadeIn delay={0.18} direction="up" className="h-full">
        <StatCard
          label={t('rateCards.marketValueTitle', 'Tổng giá trị thị trường (100%)')}
          value={formatVND(totalCurrentValue)}
          valueClass="text-emerald-400"
          variant="emerald"
          tooltip={
            <span>
              {t(
                'rateCards.marketValueTooltip',
                'Tổng giá trị của tất cả vật phẩm theo đơn giá thị trường 100% (không áp dụng chiết khấu).'
              )}
            </span>
          }
        />
      </FadeIn>

      {/* CARD 6: Số dư ví Steam */}
      <FadeIn delay={0.22} direction="up" className="h-full">
        <StatCard
          label={t('rateCards.steamWalletTitle', 'Số dư ví Steam')}
          value={formatVND(steamWalletTotal)}
          valueClass="text-sky-400 font-bold"
          variant="blue"
          tooltip={
            <span>
              {t(
                'rateCards.steamWalletTooltip',
                'Tổng số dư ví Steam hiện tại của tất cả các tài khoản được liên kết.'
              )}
            </span>
          }
        />
      </FadeIn>
    </div>
  );
}
