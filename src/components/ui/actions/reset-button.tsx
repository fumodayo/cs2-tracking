"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface ResetButtonProps {
  onReset: () => void;
  className?: string;
  isVisible: boolean;
}

export function ResetButton({
  onReset,
  className,
  isVisible,
}: ResetButtonProps) {
  const { t } = useTranslation();
  if (!isVisible) return null;

  return (
    <Button
      variant="ghost"
      onClick={onReset}
      className={cn(
        "animate-fade-slide-in h-8 cursor-pointer gap-1.5 rounded-lg border border-red-500/10 bg-red-500/5 px-3 text-xs font-bold text-red-400 transition-all duration-200 hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-300 hover:scale-[1.02] active:scale-[0.98] shadow-sm shadow-red-950/10",
        className,
      )}
    >
      <span>{t("common.clearFilters", "Clear filters")}</span>
      <X className="size-3.5 shrink-0" />
    </Button>
  );
}
