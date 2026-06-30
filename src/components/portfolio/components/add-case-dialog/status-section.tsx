"use client";

import { useTranslation } from "react-i18next";
import { Control, Controller } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FormValues } from "./types";

interface StatusSectionProps {
  control: Control<FormValues>;
  itemState: "tradeable" | "hold" | "protected";
}

export function StatusSection({ control, itemState }: StatusSectionProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label
          className="mb-1.5 block text-xs font-semibold text-muted-foreground"
          htmlFor="status-select"
        >
          {t("portfolio.itemState", "Item State")}
        </label>
        <Controller
          control={control}
          name="itemState"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(val) => field.onChange(val)}
            >
              <SelectTrigger id="status-select" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tradeable">{t("portfolio.statusTradeable", "Tradeable")}</SelectItem>
                <SelectItem value="hold">{t("portfolio.statusHold", "Hold")}</SelectItem>
                <SelectItem value="protected">{t("portfolio.statusTradeProtected", "Trade Protected")}</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {itemState === "hold" || itemState === "protected" ? (
        <div>
          <label
            className="mb-1.5 block text-xs font-semibold text-muted-foreground"
            htmlFor="hold-days-input"
          >
            {t("portfolio.remainingHoldDays", "Remaining hold days")}
          </label>
          <Controller
            control={control}
            name="holdDays"
            render={({ field }) => (
              <Input
                id="hold-days-input"
                type="number"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                placeholder={t("portfolio.exampleHoldDays", "e.g., 7")}
                className="h-10 text-sm"
              />
            )}
          />
        </div>
      ) : (
        <div className="hidden sm:block" />
      )}
    </div>
  );
}
