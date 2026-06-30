"use client";

import { Control, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { FormValues } from "./types";

interface QuantityDateSectionProps {
  control: Control<FormValues>;
}

export function QuantityDateSection({ control }: QuantityDateSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label htmlFor="add-case-quantity" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
          Số lượng
        </label>
        <Controller
          control={control}
          name="quantity"
          render={({ field }) => (
            <Input
              id="add-case-quantity"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              inputMode="numeric"
              className="h-10 text-sm"
            />
          )}
        />
      </div>
      <div>
        <label htmlFor="add-case-buy-date" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
          Ngày mua
        </label>
        <Controller
          control={control}
          name="buyDate"
          render={({ field }) => (
            <DatePicker
              id="add-case-buy-date"
              value={field.value}
              onChange={field.onChange}
              className="h-10 text-sm"
            />
          )}
        />
      </div>
    </div>
  );
}

