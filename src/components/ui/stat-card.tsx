"use client";

import React, { type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/ui/animation/count-up";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { TbInfoCircle } from "react-icons/tb";
import { HelpCircle, Layers, TrendingUp, Package } from "lucide-react";
import { cn } from "@/utils/cn";

type StatCardProps = {
  title?: string;
  label?: string; // alias for title
  value: string;
  numericValue?: number;
  valueType?: "currency" | "percent" | "number";
  unit?: string;
  valueClass?: string;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "accent" | "blue" | "emerald" | "amber" | "violet";
  variant?: "neutral" | "positive" | "negative" | "accent" | "blue" | "emerald" | "amber" | "violet"; // alias for tone
  tooltip?: ReactNode;
};

const toneClasses = {
  neutral: "border-border bg-surface text-foreground dark:border-stone-800 dark:bg-stone-900/20",
  positive: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
  negative: "border-red-500/20 bg-red-500/5 text-red-400",
  accent: "border-accent/24 bg-accent/8 text-foreground",
  blue: "border-blue-500/20 bg-blue-500/5 text-stone-50",
  emerald: "border-emerald-500/20 bg-emerald-500/5 text-stone-50",
  amber: "border-amber-500/20 bg-amber-500/5 text-stone-50",
  violet: "border-amber-500/20 bg-amber-500/5 text-stone-50", // Map violet to amber
};

const iconContainerClasses = {
  neutral: "bg-surface-muted text-muted-foreground border border-border dark:bg-stone-800/50 dark:text-stone-400 dark:border-stone-800",
  positive: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  negative: "bg-red-500/10 text-red-400 border border-red-500/20",
  accent: "bg-accent/12 text-accent border border-accent/20",
  blue: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  emerald: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  violet: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
};

const valueClasses = {
  neutral: "text-stone-100",
  positive: "text-emerald-400",
  negative: "text-red-400",
  accent: "text-accent",
  blue: "text-blue-400",
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  violet: "text-amber-400",
};

export function StatCard({
  title,
  label,
  value,
  numericValue,
  valueType = "number",
  unit,
  valueClass,
  detail,
  icon,
  tone,
  variant,
  tooltip,
}: StatCardProps) {
  // Resolve card tone (allow tone or variant fallback)
  const resolvedTone = tone || variant || "neutral";
  
  // Normalize tone for mapping styles
  const mappedTone = 
    resolvedTone === "violet" || resolvedTone === "amber" 
      ? "amber" 
      : resolvedTone;

  const displayTitle = title ?? label ?? "";

  // Auto-resolve icons based on mappedTone if no icon is passed
  const getIcon = () => {
    if (icon) return icon;
    switch (mappedTone) {
      case "blue":
        return <Layers className="size-5" />;
      case "emerald":
      case "positive":
        return <TrendingUp className="size-5" />;
      case "neutral":
      default:
        return <Package className="size-5" />;
    }
  };

  const renderValue = () => {
    if (numericValue === undefined || Number.isNaN(numericValue)) {
      return value;
    }

    if (valueType === "currency") {
      return (
        <span>
          <CountUp to={numericValue} decimals={0} separator="." />
          ₫
        </span>
      );
    }

    if (valueType === "percent") {
      return (
        <span>
          {numericValue > 0 ? "+" : ""}
          <CountUp to={numericValue} decimals={2} separator="." />%
        </span>
      );
    }

    return <CountUp to={numericValue} decimals={0} separator="." />;
  };

  const customClass = toneClasses[mappedTone] || "bg-stone-900/50";
  const iconContainerClass = iconContainerClasses[mappedTone];
  const valueColorClass = valueClass || valueClasses[mappedTone];

  return (
    <Card
      className={cn(
        "h-full p-4 transition-all duration-300 hover:scale-[1.015] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] border",
        customClass
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold tracking-wider text-stone-400 uppercase">
              {displayTitle}
            </p>
            {tooltip && (
              <TooltipProvider>
                <Tooltip content={tooltip} side="top" align="start">
                  <span className="cursor-help text-stone-500 hover:text-stone-300 transition-colors">
                    {mappedTone === "neutral" ? (
                      <TbInfoCircle className="size-3.5" />
                    ) : (
                      <HelpCircle className="size-3.5" />
                    )}
                  </span>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          <div className="mt-2 flex items-baseline gap-2">
            <span className={cn(
              "text-2xl font-bold tracking-tight",
              unit ? "font-mono" : "font-semibold",
              valueColorClass
            )}>
              {renderValue()}
            </span>
            {unit && <span className="text-xs font-semibold text-stone-500">{unit}</span>}
          </div>

          {detail && (
            <div className="mt-2 text-sm text-muted-foreground">
              {detail}
            </div>
          )}
        </div>
        <div className={cn(
          "grid size-10 shrink-0 place-items-center rounded-md transition-colors duration-200",
          iconContainerClass
        )}>
          {getIcon()}
        </div>
      </div>
    </Card>
  );
}
