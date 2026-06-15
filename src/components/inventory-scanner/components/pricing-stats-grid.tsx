"use client";

import React from "react";
import { BuffRateCard } from "../buff-rate-card";
import { RateCard } from "../rate-card";
import { StatCard } from "@/components/ui/stat-card";
import { formatVND } from "../utils";

interface PricingStatsGridProps {
  buffCnyToVndRate: number;
  setBuffCnyToVndRate: (val: number) => void;
  rateAll: number;
  setRateAll: (val: number) => void;
  rateLe: number;
  setRateLe: (val: number) => void;
  totalPrice: number;
  totalQuantity: number;
  totalInventoryCount: number;
  totalSi: number;
  totalLe: number;
}

export function PricingStatsGrid({
  buffCnyToVndRate,
  setBuffCnyToVndRate,
  rateAll,
  setRateAll,
  rateLe,
  setRateLe,
  totalPrice,
  totalQuantity,
  totalInventoryCount,
  totalSi,
  totalLe,
}: PricingStatsGridProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <BuffRateCard
          value={buffCnyToVndRate}
          onChange={setBuffCnyToVndRate}
          tooltip={
            <span>
              Tỷ giá dùng để đổi nhân dân tệ (CNY) sang đồng (VND) khi tính giá skin trên Buff163.
            </span>
          }
        />
        <RateCard
          id="rateAll"
          label="Rate sỉ (all)"
          value={rateAll}
          onChange={setRateAll}
          total={totalPrice}
          color="blue"
          desc="Giá bán khi bán sỉ toàn bộ"
          customCalculatedTotal={totalSi}
          tooltip={
            <span>
              Tổng giá trị quy đổi theo rate sỉ. Áp dụng tỷ lệ chiết khấu cho hòm, capsule, sticker và skin thường. Skin đã có giá Buff được tính 100% giá trị.
            </span>
          }
        />
        <RateCard
          id="rateLe"
          label="Rate lẻ"
          value={rateLe}
          onChange={setRateLe}
          total={totalPrice}
          color="violet"
          desc="Giá bán khi bán lẻ từng hòm"
          customCalculatedTotal={totalLe}
          tooltip={
            <span>
              Tổng giá trị quy đổi theo rate lẻ. Áp dụng tỷ lệ chiết khấu cho hòm, capsule, sticker. Skin đã có giá Buff được tính 100% giá trị.
            </span>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Tổng số lượng item định giá"
          value={String(totalQuantity)}
          unit="item"
          variant="blue"
          tooltip={
            <span>
              Tổng số lượng các vật phẩm được đưa vào bảng tính định giá (hòm, capsule, sticker, skin).
            </span>
          }
        />
        <StatCard
          label="Giá trị thị trường (100%)"
          value={formatVND(totalPrice)}
          valueClass="text-emerald-400"
          variant="emerald"
          tooltip={
            <span>
              Tổng giá trị các vật phẩm tính theo giá trị thị trường 100% (không áp dụng chiết khấu/rate).
            </span>
          }
        />
        <StatCard
          label="Tổng item trong hòm đồ"
          value={String(totalInventoryCount)}
          unit="item"
          variant="neutral"
          tooltip={
            <span>
              Tổng số lượng tất cả các vật phẩm hiện có trong hòm đồ Steam đã quét (bao gồm cả các loại item không định giá như huy hiệu, graffiti...).
            </span>
          }
        />
      </div>
    </div>
  );
}
