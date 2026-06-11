import React, { useEffect, useState } from "react";
import { Plus, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
type Option = {
  label: string;
  value: string;
};

type FacetedFilterProps = {
  title: string;
  options: Option[];
  selectedValues: Set<string>;
  onChange: (v: Set<string>) => void;
};

export const FacetedFilter: React.FC<FacetedFilterProps> = ({
  title,
  options,
  selectedValues,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = () => setIsOpen(false);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [isOpen]);

  const toggleValue = (val: string) => {
    const next = new Set(selectedValues);
    if (next.has(val)) {
      next.delete(val);
    } else {
      next.add(val);
    }
    onChange(next);
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 items-center gap-2 rounded-md border border-dashed border-stone-700 bg-stone-950/70 px-3 text-sm font-medium text-stone-300 hover:bg-stone-800"
      >
        <Plus className="size-4 text-stone-400" />
        {title}
        {selectedValues.size > 0 && (
          <>
            <div className="mx-1 h-4 w-px bg-stone-700" />
            <span className="flex h-5 items-center justify-center rounded-sm bg-stone-800 px-1.5 text-xs text-stone-200">
              {selectedValues.size}
            </span>
          </>
        )}
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-2 w-48 rounded-md border border-stone-800 bg-stone-950 p-1 shadow-xl">
          <div className="flex flex-col gap-0.5">
            {options.map((opt) => {
              const isSelected = selectedValues.has(opt.value);
              return (
                <Button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleValue(opt.value)}
                  className="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-sm text-stone-300 hover:bg-stone-800 hover:text-stone-100"
                >
                  <div
                    className={`flex size-4 shrink-0 items-center justify-center rounded-[3px] border ${
                      isSelected
                        ? "border-stone-100 bg-stone-100 text-stone-950"
                        : "border-stone-600 bg-transparent"
                    }`}
                  >
                    {isSelected && <Check className="size-3" strokeWidth={3} />}
                  </div>
                  <span className="truncate">{opt.label}</span>
                </Button>
              );
            })}
          </div>
          {selectedValues.size > 0 && (
            <>
              <div className="my-1 h-px bg-stone-800" />
              <Button
                type="button"
                onClick={() => onChange(new Set())}
                className="w-full rounded-sm px-2 py-1.5 text-center text-xs text-stone-400 hover:bg-stone-800 hover:text-stone-100"
              >
                Clear filters
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
