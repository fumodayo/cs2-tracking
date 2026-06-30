import React, { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { HelpCircle, Coins } from "lucide-react";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { formatVND, DEFAULT_BUFF_CNY_TO_VND_RATE } from "./utils";

type BuffRateCardProps = {
  value: number;
  onChange: (v: number) => void;
  tooltip?: ReactNode;
  icon?: ReactNode;
};

export const BuffRateCard: React.FC<BuffRateCardProps> = ({
  value,
  onChange,
  tooltip,
  icon,
}) => {
  const { t } = useTranslation();
  // Auto-assign Coins icon
  const getIcon = () => {
    return icon || <Coins className="size-5" />;
  };

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-start justify-between gap-3 text-stone-50">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="buffCnyToVndRate"
            className="text-xs font-semibold tracking-wider text-stone-400 uppercase cursor-pointer"
          >
            {t("inventoryScanner.buffCnyVndRateCardTitle")}
          </label>
          {tooltip && (
            <TooltipProvider>
              <Tooltip content={tooltip} side="top" align="start">
                <span className="cursor-help text-stone-500 hover:text-stone-300 transition-colors">
                  <HelpCircle className="size-3.5" />
                </span>
              </Tooltip>
            </TooltipProvider>
          )}
          <div className="flex items-center gap-1 rounded px-1.5 py-0.5 border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 transition-all focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/30 focus-within:outline-none">
            <input
              id="buffCnyToVndRate"
              type="number"
              min={1}
              value={value}
              onChange={(e) =>
                onChange(
                  Math.max(
                    1,
                    Number(e.target.value) || DEFAULT_BUFF_CNY_TO_VND_RATE,
                  ),
                )
              }
              className="w-12 bg-transparent text-right text-xs font-bold font-mono outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none text-current"
            />
            <span className="text-[10px] opacity-70">VND</span>
          </div>
        </div>
        <div className="mt-2.5">
          <span className="text-2xl font-bold tracking-tight font-mono text-emerald-400">
            {formatVND(value)}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-stone-500">
          {t("inventoryScanner.buffRateCardDesc")}
        </p>
      </div>
      
      <div className="grid size-10 shrink-0 place-items-center rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 transition-colors duration-200">
        {getIcon()}
      </div>
    </div>
  );
};
