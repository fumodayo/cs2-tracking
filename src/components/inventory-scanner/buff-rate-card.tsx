import React, { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Coins } from 'lucide-react';
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip';
import { formatVND, DEFAULT_BUFF_CNY_TO_VND_RATE } from './utils';

type BuffRateCardProps = {
  value: number;
  onChange: (v: number) => void;
  tooltip?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export const BuffRateCard: React.FC<BuffRateCardProps> = ({
  value,
  onChange,
  tooltip,
  icon,
  className,
}) => {
  const { t } = useTranslation();
  // Auto-assign Coins icon
  const getIcon = () => {
    return icon || <Coins className="size-5" />;
  };

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-stone-50 shadow-sm transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] ${className || ''}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="buffCnyToVndRate"
            className="cursor-pointer text-xs font-semibold tracking-wider text-stone-400 uppercase"
          >
            {t('inventoryScanner.buffCnyVndRateCardTitle')}
          </label>
          {tooltip && (
            <TooltipProvider>
              <Tooltip content={tooltip} side="top" align="start">
                <span className="cursor-help text-stone-500 transition-colors hover:text-stone-300">
                  <HelpCircle className="size-3.5" />
                </span>
              </Tooltip>
            </TooltipProvider>
          )}
          <div className="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400 transition-all focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/30 focus-within:outline-none">
            <input
              id="buffCnyToVndRate"
              type="number"
              min={1}
              value={value}
              onChange={(e) =>
                onChange(Math.max(1, Number(e.target.value) || DEFAULT_BUFF_CNY_TO_VND_RATE))
              }
              className="w-12 [appearance:textfield] bg-transparent text-right font-mono text-xs font-bold text-current outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-[10px] opacity-70">VND</span>
          </div>
        </div>
        <div className="mt-2.5">
          <span className="font-mono text-2xl font-bold tracking-tight text-emerald-400">
            {formatVND(value)}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-stone-500">
          {t('inventoryScanner.buffRateCardDesc')}
        </p>
      </div>

      <div className="grid size-10 shrink-0 place-items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 transition-colors duration-200">
        {getIcon()}
      </div>
    </div>
  );
};
