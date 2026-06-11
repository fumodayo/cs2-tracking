import React, { ReactNode } from "react";
import { HelpCircle, Layers, TrendingUp, Package } from "lucide-react";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";

type StatCardProps = {
  label: string;
  value: string;
  unit?: string;
  valueClass?: string;
  tooltip?: ReactNode;
  variant?: "blue" | "emerald" | "amber" | "violet" | "neutral";
  icon?: ReactNode;
};

const toneClasses = {
  blue: "border-blue-500/20 bg-blue-500/5 text-stone-50",
  emerald: "border-emerald-500/20 bg-emerald-500/5 text-stone-50",
  amber: "border-amber-500/20 bg-amber-500/5 text-stone-50",
  violet: "border-amber-500/20 bg-amber-500/5 text-stone-50", // Map violet to amber
  neutral: "border-stone-800 bg-stone-900/20 text-stone-50",
};

const iconContainerClasses = {
  blue: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  emerald: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  violet: "bg-amber-500/10 text-amber-400 border border-amber-500/20", // Map violet to amber
  neutral: "bg-stone-800/50 text-stone-400 border border-stone-800",
};

const valueClasses = {
  blue: "text-blue-400",
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  violet: "text-amber-400",
  neutral: "text-stone-100",
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit,
  valueClass,
  tooltip,
  variant = "neutral",
  icon,
}) => {
  const cardTone = variantStylesMap(variant);

  // Auto-assign icons based on card variant
  const getIcon = () => {
    if (icon) return icon;
    switch (cardTone) {
      case "blue":
        return <Layers className="size-5" />;
      case "emerald":
        return <TrendingUp className="size-5" />;
      case "neutral":
      default:
        return <Package className="size-5" />;
    }
  };

  const customClass = toneClasses[cardTone] || "bg-stone-900/50";
  const iconContainerClass = iconContainerClasses[cardTone];
  const valueColorClass = valueClass || valueClasses[cardTone];

  return (
    <div className={`rounded-xl border p-4 shadow-sm transition-all duration-300 hover:scale-[1.015] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-start justify-between gap-3 ${customClass}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold tracking-wider text-stone-400 uppercase">{label}</p>
          {tooltip && (
            <TooltipProvider>
              <Tooltip content={tooltip} side="top" align="start">
                <span className="cursor-help text-stone-500 hover:text-stone-300 transition-colors">
                  <HelpCircle className="size-3.5" />
                </span>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className={`text-2xl font-bold tracking-tight font-mono ${valueColorClass}`}>{value}</span>
          {unit && <span className="text-xs font-semibold text-stone-500">{unit}</span>}
        </div>
      </div>
      <div className={`grid size-10 shrink-0 place-items-center rounded-md transition-colors duration-200 ${iconContainerClass}`}>
        {getIcon()}
      </div>
    </div>
  );
};

function variantStylesMap(variant: string): "blue" | "emerald" | "amber" | "neutral" {
  if (variant === "violet" || variant === "amber") return "amber";
  if (variant === "emerald") return "emerald";
  if (variant === "blue") return "blue";
  return "neutral";
}
