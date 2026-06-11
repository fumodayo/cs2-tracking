"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/ui/animation/CountUp";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { TbInfoCircle } from "react-icons/tb";

import { cn } from "@/utils/cn";

type StatCardProps = {
  title: string;
  value: string;
  detail?: ReactNode;
  icon: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "accent";
  numericValue?: number;
  valueType?: "currency" | "percent" | "number";
  tooltip?: ReactNode;
};

const toneClasses = {
  neutral: "border-border bg-surface text-foreground",
  positive: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
  negative: "border-red-500/20 bg-red-500/5 text-red-400",
  accent: "border-accent/24 bg-accent/8 text-foreground",
};

const iconContainerClasses = {
  neutral: "bg-surface-muted text-muted-foreground border border-border",
  positive: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  negative: "bg-red-500/10 text-red-400 border border-red-500/20",
  accent: "bg-accent/12 text-accent border border-accent/20",
};

export function StatCard({
  title,
  value,
  detail,
  icon,
  tone = "neutral",
  numericValue,
  valueType = "number",
  tooltip,
}: StatCardProps) {
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

  return (
    <Card
      className={cn(
        "h-full p-4 transition-all duration-300 hover:scale-[1.015] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] border",
        toneClasses[tone]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              {title}
            </p>
            {tooltip && (
              <TooltipProvider>
                <Tooltip content={tooltip} side="top" align="start">
                  <span className="cursor-help text-muted-foreground opacity-60 hover:opacity-100 transition-opacity">
                    <TbInfoCircle className="size-3.5" />
                  </span>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <p className={cn(
            "mt-2 text-2xl font-semibold tracking-normal",
            tone === "accent" && "text-accent"
          )}>
            {renderValue()}
          </p>
          {detail ? (
            <div className="mt-2 text-sm text-muted-foreground">
              {detail}
            </div>
          ) : null}
        </div>
        <div className={cn(
          "grid size-10 shrink-0 place-items-center rounded-md transition-colors duration-200",
          iconContainerClasses[tone]
        )}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
