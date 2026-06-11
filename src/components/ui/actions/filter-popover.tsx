"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Plus, Search, Check, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";

interface FilterPopoverProps<TValue extends string> {
  label: string;
  options: Array<{
    label: string;
    value: TValue;
    icon?: React.ComponentType<{ className?: string }>;
  }>;
  selectedValues: TValue[];
  onChange: (values: TValue[]) => void;
  disabled?: boolean;
  showSearch?: boolean;
}

export function FilterPopover<TValue extends string>({
  label,
  options,
  selectedValues,
  onChange,
  disabled = false,
  showSearch = true,
}: FilterPopoverProps<TValue>) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const selectedLabels = useMemo(() => {
    return options
      .filter((option) => selectedValues.includes(option.value))
      .map((option) => option.label);
  }, [options, selectedValues]);

  const filteredOptions = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.value.toLowerCase().includes(query),
    );
  }, [options, searchValue]);

  const handleCheckedChange = (value: TValue) => {
    const isChecked = selectedValues.includes(value);
    const newValues = isChecked
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onChange(newValues);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "hover:bg-stone-850 h-8 cursor-pointer border-dashed border-stone-800 bg-stone-900/40 px-3 text-xs font-medium text-stone-300 shadow-sm transition-all hover:text-stone-100 disabled:cursor-not-allowed disabled:opacity-50",
            selectedValues.length > 0 &&
              "border-solid border-blue-500/30 bg-blue-500/[0.03] text-blue-400 hover:bg-blue-500/[0.06] hover:text-blue-300",
          )}
        >
          <Plus
            className={cn(
              "size-3.5 text-stone-500 transition-colors group-hover:text-stone-300",
              selectedValues.length > 0 &&
                "text-blue-400 group-hover:text-blue-300",
            )}
          />
          <span>{label}</span>

          {selectedLabels.length > 0 && (
            <>
              <div className="mx-1 h-3.5 w-px bg-stone-800 transition-colors group-hover:bg-stone-700" />
              <div className="flex items-center gap-1">
                {selectedLabels.length >= 3 ? (
                  <div className="inline-flex items-center rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-400">
                    {selectedValues.length} đã chọn
                  </div>
                ) : (
                  selectedLabels.map((itemLabel) => (
                    <div
                      key={itemLabel}
                      className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-400"
                    >
                      {itemLabel}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="animate-fade-slide-in z-50 w-60 overflow-hidden rounded-xl border border-stone-800 bg-stone-950/95 p-0 text-stone-200 shadow-2xl backdrop-blur-md"
        >
          <div className="flex h-full w-full flex-col overflow-hidden">
            {/* Search Input */}
            {showSearch && (
              <div className="flex items-center gap-2 border-b border-stone-900 px-3 py-2">
                <Search className="size-3.5 shrink-0 text-stone-500" />
                <input
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={`Tìm kiếm...`}
                  className="h-7 w-full border-none bg-transparent text-xs text-stone-200 outline-none placeholder:text-stone-500 focus:ring-0"
                  autoFocus
                />
              </div>
            )}

            {/* Select List */}
            <div
              className="hover:[&::-webkit-scrollbar-thumb]:bg-stone-750 max-h-60 overflow-y-auto p-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-800 [&::-webkit-scrollbar-track]:bg-transparent"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "var(--border) transparent",
              }}
            >
              {filteredOptions.length > 0 ? (
                filteredOptions.map(
                  ({ label: optionLabel, value, icon: Icon }) => {
                    if (
                      value === "separator" ||
                      value.startsWith("separator:")
                    ) {
                      return (
                        <div
                          key={value}
                          className="mt-1 border-t border-stone-900 px-2.5 py-1.5 text-[10px] font-bold tracking-wider text-stone-500 uppercase select-none first:mt-0 first:border-none"
                        >
                          {optionLabel}
                        </div>
                      );
                    }
                    const isChecked = selectedValues.includes(value);
                    return (
                      <Button
                        key={value}
                        variant="ghost"
                        onClick={() => handleCheckedChange(value)}
                        className={cn(
                          "relative flex w-full cursor-pointer items-center justify-start gap-2 rounded-lg px-2 py-2 text-start text-xs font-semibold text-stone-300 transition-colors outline-none select-none hover:bg-stone-900 hover:text-stone-100",
                          isChecked &&
                            "bg-blue-500/[0.04] text-blue-400 hover:bg-blue-500/[0.08] hover:text-blue-300",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex size-4 items-center justify-center rounded border border-stone-800 bg-stone-950 transition-all",
                            isChecked && "border-blue-500/40 bg-blue-500/10",
                          )}
                        >
                          {isChecked && (
                            <Check className="size-3 text-blue-400" />
                          )}
                        </span>
                        {Icon && (
                          <Icon className="size-4.5 shrink-0 text-stone-400/80" />
                        )}
                        <span className="truncate">{optionLabel}</span>
                      </Button>
                    );
                  },
                )
              ) : (
                <p className="p-4 text-center text-xs text-stone-500">
                  Không tìm thấy kết quả.
                </p>
              )}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
