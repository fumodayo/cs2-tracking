"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

import { Button } from "@/components/ui/button";

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
  if (!isVisible) return null;

  return (
    <Button
      variant="ghost"
      onClick={onReset}
      className={cn(
        "animate-fade-slide-in h-8 cursor-pointer px-2 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300",
        className,
      )}
    >
      <span>Xóa lọc</span>
      <X className="size-3.5" />
    </Button>
  );
}
