import { Loader2, Trash2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CaseThumbnail } from "./case-thumbnail";
import type { PortfolioTableRow } from "./portfolio-table-model";

type SellSelectedDialogItemRowProps = {
  item: PortfolioTableRow;
  isLoading: boolean;
  sellQty: number;
  maxQty: number;
  wholesaleRate: number;
  retailRate: number;
  buffPricesCny?: Record<string, number>;
  buffCnyToVndRate?: number;
  buffCnyPrices: Record<string, string>;
  setBuffCnyPrices: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  buffRates: Record<string, string>;
  setBuffRates: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  itemRetailRates: Record<string, string>;
  itemWholesaleRates: Record<string, string>;
  handleQuantityChange: (id: string, value: number, maxQuantity: number) => void;
  handleWholesaleRateChange: (id: string, value: string) => void;
  handleRetailRateChange: (id: string, value: string) => void;
  setConfirmSingle: (
    val: { open: boolean; itemId: string; quantity: number; itemName: string } | null,
  ) => void;
  excludeItem: (id: string) => void;
  formatCurrency: (val: number) => string;
};

export function SellSelectedDialogItemRow({
  item,
  isLoading,
  sellQty,
  maxQty,
  wholesaleRate,
  retailRate,
  buffPricesCny,
  buffCnyToVndRate,
  buffCnyPrices,
  setBuffCnyPrices,
  buffRates,
  setBuffRates,
  itemRetailRates,
  itemWholesaleRates,
  handleQuantityChange,
  handleWholesaleRateChange,
  handleRetailRateChange,
  setConfirmSingle,
  excludeItem,
  formatCurrency,
}: SellSelectedDialogItemRowProps) {
  const unitBuy = item.buyPrice;
  let unitCurrent = item.currentPrice ?? item.buyPrice;

  // Skin BUFF price check (same as calculateRatedValue logic)
  const hasBuff =
    item.itemType === "skin" &&
    item.currentPrice !== null &&
    item.steamPrice !== null &&
    item.steamPrice !== undefined &&
    item.currentPrice !== item.steamPrice;

  if (hasBuff) {
    const cnyPriceVal = Number(
      buffCnyPrices[item.id] !== undefined
        ? buffCnyPrices[item.id]
        : (buffPricesCny?.[item.case.marketHashName] ??
            (item.currentPrice
              ? item.currentPrice / (buffCnyToVndRate ?? 3600)
              : 0)),
    );
    const cnyRateVal = Number(
      buffRates[item.id] !== undefined
        ? buffRates[item.id]
        : (buffCnyToVndRate ?? 3600),
    );
    unitCurrent = Math.round(cnyPriceVal * cnyRateVal);
  }

  const isFullSell = sellQty === maxQty;

  const itemRetailRateVal = Number(
    itemRetailRates[item.id] !== undefined
      ? itemRetailRates[item.id]
      : retailRate,
  );
  const itemWholesaleRateVal = Number(
    itemWholesaleRates[item.id] !== undefined
      ? itemWholesaleRates[item.id]
      : wholesaleRate,
  );

  const activeRate = hasBuff
    ? 100
    : !isFullSell
      ? itemRetailRateVal
      : itemWholesaleRateVal;
  const activeRateStr = isFullSell
    ? itemWholesaleRates[item.id] !== undefined
      ? itemWholesaleRates[item.id]
      : String(wholesaleRate)
    : itemRetailRates[item.id] !== undefined
      ? itemRetailRates[item.id]
      : String(retailRate);

  const unitSell = Math.round(unitCurrent * (activeRate / 100));

  const rowInvested = unitBuy * sellQty;
  const rowCurrentValue = unitSell * sellQty;
  const rowProfit = rowCurrentValue - rowInvested;
  const rowProfitPositive = rowProfit >= 0;

  return (
    <div
      className={`relative flex gap-4 overflow-hidden rounded-[5px] border bg-gradient-to-r from-stone-950/45 via-stone-950/20 to-stone-950/45 py-3.5 pr-4 pl-4 transition-all duration-300 ${
        isLoading
          ? "pointer-events-none border-red-500/20 bg-red-950/5 opacity-50"
          : isFullSell
            ? "border-stone-800 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] hover:border-red-500/35 hover:bg-stone-900/10 hover:shadow-[0_0_20px_rgba(239,68,68,0.02)]"
            : "border-stone-800 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] hover:border-blue-500/35 hover:bg-stone-900/10 hover:shadow-[0_0_20px_rgba(37,99,235,0.02)]"
      }`}
    >
      {/* Custom decorative technical indicator line */}
      <div
        className={`absolute top-0 bottom-0 left-0 w-[3px] transition-all ${
          isFullSell
            ? "bg-gradient-to-b from-red-500/80 to-red-600/20"
            : "bg-gradient-to-b from-blue-500/80 to-blue-600/20"
        }`}
      />

      {/* Left Column: Big Thumbnail */}
      <div className="group relative mt-0.5 flex h-[60px] w-[60px] shrink-0 items-center justify-center self-start rounded-[3px] border border-stone-800 bg-stone-950 p-1.5 shadow-md transition-transform duration-200 hover:scale-105">
        {hasBuff && (
          <div className="pointer-events-none absolute top-0 left-0 z-10 h-8 w-8 overflow-hidden rounded-tl-[3px] select-none">
            <div className="absolute top-[-3px] left-[-20px] flex h-[15px] w-[50px] rotate-[-45deg] items-center justify-center bg-gradient-to-r from-blue-500 to-blue-600 shadow-sm">
              <span className="font-mono text-[7px] font-black tracking-tighter text-stone-950">
                BUFF
              </span>
            </div>
          </div>
        )}
        <CaseThumbnail
          imageUrl={item.case.imageUrl}
          name={item.case.name}
          size="lg"
        />
      </div>

      {/* Right Column: Content Container */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* Row 1: Item Header (Name, Sell Button, Profit Badge and Exclude Button) */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: Name, Sell button, and Lãi/Lỗ ròng badge */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <p
              className="truncate text-xs leading-tight font-extrabold tracking-wide text-stone-100 transition-colors hover:text-white sm:text-sm"
              title={item.case.name}
            >
              {item.case.name}
            </p>

            <Button
              variant={isFullSell ? "danger" : "outline"}
              size="sm"
              disabled={isLoading}
              onClick={() => {
                setConfirmSingle({
                  open: true,
                  itemId: item.id,
                  quantity: sellQty,
                  itemName: item.case.name,
                });
              }}
              className={`h-7 shrink-0 rounded-[4px] px-2.5 font-mono text-[10px] font-black tracking-wider uppercase transition-all duration-200 ${
                isFullSell
                  ? "border-red-500/25 bg-red-950/20 text-red-400 hover:border-red-500 hover:bg-red-500 hover:text-stone-950"
                  : "border-blue-500/25 bg-blue-950/10 text-blue-400 hover:border-blue-500 hover:bg-blue-500 hover:text-stone-950"
              }`}
            >
              {isLoading ? (
                <Loader2 className="size-3 animate-spin text-current" />
              ) : (
                <span>Bán</span>
              )}
            </Button>

            {/* Item Profit/Loss Badge */}
            <div
              className={`flex h-6 shrink-0 items-center justify-center rounded-[3px] border px-2.5 font-mono text-[10px] font-black shadow-sm transition-all duration-300 select-none ${
                rowProfitPositive
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.06)]"
                  : "border-red-500/20 bg-red-500/10 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.06)]"
              }`}
            >
              {rowProfitPositive ? "+" : ""}
              {formatCurrency(rowProfit)}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              onClick={() => excludeItem(item.id)}
              title="Bỏ chọn vật phẩm"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[4px] border border-stone-800 bg-stone-950 text-stone-500 transition-all hover:border-red-500/30 hover:bg-red-950/15 hover:text-red-400"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Row 2: Item Calculations (Quantity, Equation flow, Profit/Loss) */}
        <div className="flex flex-wrap items-center justify-start gap-4 pt-0.5 xl:gap-6">
          {/* Column 2: Quantity selector */}
          <div className="flex w-24 shrink-0 flex-col gap-1">
            <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500 uppercase">
              S.Lượng bán
            </label>
            <div className="flex h-8 items-center overflow-hidden rounded-[4px] border border-stone-800 bg-stone-950 transition-all duration-200 focus-within:border-stone-700">
              <Button
                type="button"
                onClick={() =>
                  handleQuantityChange(item.id, sellQty - 1, maxQty)
                }
                disabled={sellQty <= 1 || isLoading}
                className="flex h-full w-8 items-center justify-center text-stone-500 transition-colors hover:bg-stone-900/60 hover:text-stone-300 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Minus className="size-3" />
              </Button>
              <input
                type="number"
                value={sellQty}
                onChange={(e) =>
                  handleQuantityChange(
                    item.id,
                    parseInt(e.target.value) || 1,
                    maxQty,
                  )
                }
                disabled={isLoading}
                className="w-full flex-1 [appearance:textfield] bg-transparent text-center font-mono text-xs font-bold text-stone-100 outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <Button
                type="button"
                onClick={() =>
                  handleQuantityChange(item.id, sellQty + 1, maxQty)
                }
                disabled={sellQty >= maxQty || isLoading}
                className="flex h-full w-8 items-center justify-center text-stone-500 transition-colors hover:bg-stone-900/60 hover:text-stone-300 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Plus className="size-3" />
              </Button>
            </div>
          </div>

          {/* Column 3: The Equation Flow */}
          {hasBuff ? (
            <div
              className={`flex shrink-0 flex-wrap items-center gap-1.5 transition-all duration-300 sm:flex-nowrap ${
                sellQty > 1 ? "xl:w-[35rem]" : "xl:w-[25rem]"
              }`}
            >
              {/* Input CNY Price */}
              <div className="flex w-[7.5rem] flex-col gap-1">
                <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500 uppercase">
                  Giá BUFF CNY
                </label>
                <div className="flex h-8 items-center rounded-[4px] border border-stone-800 bg-stone-950 px-2.5 transition-all focus-within:border-blue-500/40">
                  <input
                    type="number"
                    step="0.01"
                    value={
                      buffCnyPrices[item.id] !== undefined
                        ? buffCnyPrices[item.id]
                        : ""
                    }
                    onChange={(e) =>
                      setBuffCnyPrices((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                    className="w-full [appearance:textfield] bg-transparent text-right font-mono text-xs font-bold text-stone-100 outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="ml-1.5 font-mono text-[10px] font-extrabold text-blue-500 select-none">
                    ¥
                  </span>
                </div>
              </div>

              <span className="mb-2 flex h-8 items-center justify-center self-end px-0.5 font-mono text-xs font-black text-stone-500 select-none">
                ×
              </span>

              {/* Input Rate CNY */}
              <div className="flex w-[7.5rem] flex-col gap-1">
                <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500 uppercase">
                  Tỷ giá CNY
                </label>
                <div className="flex h-8 items-center rounded-[4px] border border-stone-800 bg-stone-950 px-2.5 transition-all focus-within:border-blue-500/40">
                  <input
                    type="number"
                    value={
                      buffRates[item.id] !== undefined ? buffRates[item.id] : ""
                    }
                    onChange={(e) =>
                      setBuffRates((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                    className="w-full [appearance:textfield] bg-transparent text-right font-mono text-xs font-bold text-stone-100 outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="ml-1.5 font-mono text-[9px] font-bold text-stone-500 select-none">
                    đ
                  </span>
                </div>
              </div>

              <span className="mb-2 flex h-8 items-center justify-center self-end px-0.5 font-mono text-xs font-black text-stone-500 select-none">
                =
              </span>

              {/* Calculated Unit Price VND */}
              <div className="flex w-[7.5rem] flex-col gap-1">
                <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500 uppercase">
                  Giá bán VND
                </label>
                <div className="flex h-8 items-center justify-end rounded-[4px] border border-blue-500/20 bg-blue-500/5 px-2.5 text-blue-400 select-none">
                  <span className="font-mono text-xs font-bold">
                    {formatCurrency(unitCurrent)}
                  </span>
                </div>
              </div>

              {sellQty > 1 && (
                <>
                  <span className="mb-2 flex h-8 items-center justify-center self-end px-0.5 font-mono text-xs font-black text-stone-500 select-none">
                    →
                  </span>

                  {/* Total calculated price for BUFF row */}
                  <div className="flex w-[8.5rem] flex-col gap-1">
                    <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500 uppercase">
                      Tổng tiền ({sellQty} cái)
                    </label>
                    <div className="flex h-8 items-center justify-end rounded-[4px] border border-blue-500/25 bg-blue-500/10 px-2.5 font-black text-blue-300 shadow-[0_0_12px_rgba(245,158,11,0.06)] select-none">
                      <span className="font-mono text-xs">
                        {formatCurrency(rowCurrentValue)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div
              className={`flex shrink-0 flex-wrap items-center gap-1.5 transition-all duration-300 sm:flex-nowrap ${
                sellQty > 1 ? "xl:w-[35rem]" : "xl:w-[25rem]"
              }`}
            >
              {/* Price 1 Unit */}
              <div className="flex w-[7.5rem] flex-col gap-1">
                <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500 uppercase">
                  Giá hiện tại
                </label>
                <div className="flex h-8 items-center justify-end rounded-[4px] border border-stone-800 bg-stone-950 px-2.5 text-stone-400 select-none">
                  <span className="font-mono text-xs font-bold">
                    {formatCurrency(unitCurrent)}
                  </span>
                </div>
              </div>

              <span className="mb-2 flex h-8 items-center justify-center self-end px-0.5 font-mono text-xs font-black text-stone-500 select-none">
                ×
              </span>

              {/* Active Rate Input Box */}
              <div className="flex w-[7.5rem] flex-col gap-1">
                <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500 uppercase">
                  {isFullSell ? "Tỷ lệ sỉ %" : "Tỷ lệ lẻ %"}
                </label>
                <div
                  className={`flex h-8 items-center rounded-[4px] border px-2.5 transition-all ${
                    isFullSell
                      ? "border-red-500/30 bg-red-500/5 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.05)] focus-within:border-red-500/50"
                      : "border-blue-500/30 bg-blue-500/5 text-blue-400 shadow-[0_0_8px_rgba(37,99,235,0.05)] focus-within:border-blue-500/50"
                  }`}
                >
                  <input
                    type="number"
                    min="0"
                    max="200"
                    value={activeRateStr}
                    onChange={(e) => {
                      if (isFullSell) {
                        handleWholesaleRateChange(item.id, e.target.value);
                      } else {
                        handleRetailRateChange(item.id, e.target.value);
                      }
                    }}
                    disabled={isLoading}
                    className="w-full [appearance:textfield] bg-transparent text-right font-mono text-xs font-black text-stone-100 outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="ml-1 text-[9px] font-bold text-stone-500 select-none">
                    %
                  </span>
                </div>
              </div>

              <span className="mb-2 flex h-8 items-center justify-center self-end px-0.5 font-mono text-xs font-black text-stone-500 select-none">
                =
              </span>

              {/* Calculated Sell Price VND */}
              <div className="flex w-[7.5rem] flex-col gap-1">
                <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500 uppercase">
                  Giá bán VND
                </label>
                <div
                  className={`flex h-8 items-center justify-end rounded-[4px] border px-2.5 select-none ${
                    isFullSell
                      ? "border-red-500/20 bg-red-500/5 font-bold text-red-400"
                      : "border-blue-500/20 bg-blue-500/5 font-bold text-blue-400"
                  }`}
                >
                  <span className="font-mono text-xs">
                    {formatCurrency(unitSell)}
                  </span>
                </div>
              </div>

              {sellQty > 1 && (
                <>
                  <span className="mb-2 flex h-8 items-center justify-center self-end px-0.5 font-mono text-xs font-black text-stone-500 select-none">
                    →
                  </span>

                  {/* Total calculated price for the row */}
                  <div className="flex w-[8.5rem] flex-col gap-1">
                    <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500 uppercase">
                      Tổng tiền ({sellQty} cái)
                    </label>
                    <div
                      className={`flex h-8 items-center justify-end rounded-[4px] border px-2.5 select-none ${
                        isFullSell
                          ? "border-red-500/25 bg-red-500/10 font-black text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.06)]"
                          : "border-blue-500/25 bg-blue-500/10 font-black text-blue-300 shadow-[0_0_12px_rgba(37,99,235,0.06)]"
                      }`}
                    >
                      <span className="font-mono text-xs">
                        {formatCurrency(rowCurrentValue)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
