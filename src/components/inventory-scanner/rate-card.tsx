import React, { ReactNode } from 'react';
import { HelpCircle, Percent, ShoppingBag } from 'lucide-react';
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip';
import { formatVND } from './utils';

type RateCardProps = {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  total: number;
  color: 'blue' | 'amber';
  desc: string;
  customCalculatedTotal?: number;
  tooltip?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

const toneClasses = {
  blue: 'border-blue-500/20 bg-blue-500/5 text-stone-50',
  amber: 'border-amber-500/20 bg-amber-500/5 text-stone-50',
};

const iconContainerClasses = {
  blue: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
};

const valueClasses = {
  blue: 'text-blue-400',
  amber: 'text-amber-400',
};

const inputBgClasses = {
  blue: 'border-blue-500/20 bg-blue-500/10 text-blue-400 focus-within:border-blue-500/50 focus-within:ring-blue-500/30',
  amber:
    'border-amber-500/20 bg-amber-500/10 text-amber-400 focus-within:border-amber-500/50 focus-within:ring-amber-500/30',
};

export const RateCard: React.FC<RateCardProps> = ({
  id,
  label,
  value,
  onChange,
  total,
  color,
  desc,
  customCalculatedTotal,
  tooltip,
  icon,
  className,
}) => {
  const displayTotal =
    customCalculatedTotal !== undefined ? customCalculatedTotal : (total * value) / 100;

  // Auto-assign icons
  const getIcon = () => {
    if (icon) return icon;
    return color === 'blue' ? <Percent className="size-5" /> : <ShoppingBag className="size-5" />;
  };

  const customClass = toneClasses[color];
  const iconContainerClass = iconContainerClasses[color];
  const valueColorClass = valueClasses[color];
  const inputBgClass = inputBgClasses[color];

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border p-4 shadow-sm transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] ${customClass} ${className || ''}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={id}
            className="cursor-pointer text-xs font-semibold tracking-wider text-stone-400 uppercase"
          >
            {label}
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
          <div
            className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-bold transition-all focus-within:ring-1 focus-within:outline-none ${inputBgClass}`}
          >
            <input
              id={id}
              type="number"
              min={1}
              max={100}
              value={value}
              onChange={(e) => onChange(Math.min(100, Math.max(1, Number(e.target.value) || 0)))}
              className="w-8 [appearance:textfield] bg-transparent text-center font-mono text-xs font-bold text-current outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-[10px] opacity-70">%</span>
          </div>
        </div>
        <div className="mt-2.5">
          <span className={`font-mono text-2xl font-bold tracking-tight ${valueColorClass}`}>
            {formatVND(displayTotal)}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-stone-500">{desc}</p>
      </div>

      <div
        className={`grid size-10 shrink-0 place-items-center rounded-md transition-colors duration-200 ${iconContainerClass}`}
      >
        {getIcon()}
      </div>
    </div>
  );
};
