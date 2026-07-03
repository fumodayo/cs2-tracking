'use client';

import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Plus, Search, Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface FilterPopoverProps<TValue extends string> {
  label: string;
  options: Array<{
    label: string;
    value: TValue;
    icon?: React.ComponentType<{ className?: string }>;
    group?: string;
    subValues?: string[];
  }>;
  selectedValues: TValue[];
  onChange: (values: TValue[]) => void;
  disabled?: boolean;
  showSearch?: boolean;
  hideOptionIcons?: boolean;
}

export function FilterPopover<TValue extends string>({
  label,
  options,
  selectedValues,
  onChange,
  disabled = false,
  showSearch = true,
  hideOptionIcons = false,
}: FilterPopoverProps<TValue>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

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
        option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query)
    );
  }, [options, searchValue]);

  const handleCheckedChange = (value: TValue, optionSubValues?: string[]) => {
    if (value.startsWith('group:') && optionSubValues) {
      const allSelected = optionSubValues.every((v) => selectedValues.includes(v as TValue));
      let newValues: TValue[];
      if (allSelected) {
        newValues = selectedValues.filter((v) => !optionSubValues.includes(v));
      } else {
        newValues = Array.from(new Set([...selectedValues, ...optionSubValues])) as TValue[];
      }
      onChange(newValues);
      return;
    }

    const isChecked = selectedValues.includes(value);
    const newValues = isChecked
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onChange(newValues);
  };

  const searchInputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'hover:bg-stone-850 h-8 cursor-pointer gap-1.5 rounded-lg border border-dashed border-stone-800 bg-stone-900/40 px-3 text-xs font-semibold text-stone-300 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-stone-700 hover:text-stone-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
            selectedValues.length > 0 &&
              'border-accent/30 bg-accent/5 text-accent hover:border-accent/50 hover:bg-accent/10 hover:text-accent-hover shadow-accent/5 border-solid shadow-sm'
          )}
        >
          <Plus
            className={cn(
              'size-3.5 shrink-0 text-stone-500 transition-colors group-hover:text-stone-300',
              selectedValues.length > 0 && 'text-accent group-hover:text-accent-hover'
            )}
          />
          <span>{label}</span>

          {selectedLabels.length > 0 && (
            <>
              <div className="mx-1 h-3.5 w-px bg-stone-800 transition-colors group-hover:bg-stone-700" />
              <div className="flex items-center gap-1">
                {selectedLabels.length >= 3 ? (
                  <div className="bg-accent/10 text-accent inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold">
                    {t('common.selected', { count: selectedValues.length })}
                  </div>
                ) : (
                  selectedLabels.map((itemLabel) => (
                    <div
                      key={itemLabel}
                      className="bg-accent/10 text-accent rounded px-1.5 py-0.5 text-[10px] font-bold"
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
          className="animate-fade-slide-in z-50 w-72 overflow-hidden rounded-xl border border-stone-800 bg-stone-950/95 p-0 text-stone-200 shadow-2xl backdrop-blur-md"
        >
          <div className="flex h-full w-full flex-col overflow-hidden">
            {/* Search Input */}
            {showSearch && (
              <div className="flex items-center gap-2 border-b border-stone-900 px-3 py-2">
                <Search className="size-3.5 shrink-0 text-stone-500" />
                <input
                  ref={searchInputRef}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={t('common.search', 'Search') + '...'}
                  className="h-7 w-full border-none bg-transparent text-xs text-stone-200 outline-none placeholder:text-stone-500 focus:ring-0"
                />
              </div>
            )}

            {/* Select List */}
            <div
              className="hover:[&::-webkit-scrollbar-thumb]:bg-stone-750 max-h-60 overflow-y-auto p-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-800 [&::-webkit-scrollbar-track]:bg-transparent"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'var(--border) transparent',
              }}
            >
              {(() => {
                if (filteredOptions.length === 0) {
                  return (
                    <p className="p-4 text-center text-xs text-stone-500">
                      {t('common.noResults', 'No results found.')}
                    </p>
                  );
                }

                const renderedValues = new Set<string>();
                const elements: React.ReactNode[] = [];

                for (let i = 0; i < filteredOptions.length; i++) {
                  const option = filteredOptions[i];
                  const { label: optionLabel, value, icon: Icon, subValues } = option;

                  if (renderedValues.has(value)) {
                    continue;
                  }

                  if (value === 'separator' || value.startsWith('separator:')) {
                    elements.push(
                      <div
                        key={value}
                        className="mt-1 border-t border-stone-900 px-2.5 py-1.5 text-[10px] font-bold tracking-wider text-stone-500 uppercase select-none first:mt-0 first:border-none"
                      >
                        {optionLabel}
                      </div>
                    );
                    renderedValues.add(value);
                    continue;
                  }

                  if (value.startsWith('group:')) {
                    const isGroupHeaderChecked = subValues
                      ? subValues.every((v) => selectedValues.includes(v as TValue))
                      : false;
                    const isGroupHeaderPartiallyChecked =
                      subValues &&
                      !isGroupHeaderChecked &&
                      subValues.some((v) => selectedValues.includes(v as TValue));

                    elements.push(
                      <Button
                        key={value}
                        variant="ghost"
                        onClick={() => handleCheckedChange(value, subValues)}
                        className="relative mt-2 flex w-full cursor-pointer items-center justify-start gap-2 rounded-lg px-2.5 py-1.5 text-start text-[10px] font-bold tracking-wide text-stone-500 uppercase transition-all outline-none select-none hover:bg-stone-900 hover:text-stone-300"
                      >
                        <span className="inline-flex size-3.5 shrink-0 items-center justify-center">
                          {isGroupHeaderChecked ? (
                            <Check className="text-accent size-2.5" />
                          ) : isGroupHeaderPartiallyChecked ? (
                            <div className="bg-accent size-1 animate-pulse rounded" />
                          ) : null}
                        </span>
                        <span className="truncate">{optionLabel}</span>
                      </Button>
                    );
                    renderedValues.add(value);

                    const groupKey = value.substring(6);
                    const groupItems = filteredOptions.filter((opt) => opt.group === groupKey);

                    if (groupItems.length > 0) {
                      elements.push(
                        <div
                          key={`group-grid-${groupKey}`}
                          className="mt-1 flex flex-col gap-0.5 px-2 py-0.5"
                        >
                          {groupItems.map((item) => {
                            const isChecked = selectedValues.includes(item.value);
                            const ItemIcon = item.icon;
                            renderedValues.add(item.value);

                            return (
                              <Button
                                key={item.value}
                                variant="ghost"
                                onClick={() => handleCheckedChange(item.value)}
                                className="relative flex w-full cursor-pointer items-center justify-start gap-1.5 rounded-md px-2 py-1 text-start text-xs font-semibold text-stone-400 transition-all outline-none select-none hover:bg-stone-900/60 hover:text-stone-200"
                              >
                                <span className="inline-flex size-3.5 shrink-0 items-center justify-center">
                                  {isChecked && <Check className="text-accent size-2.5" />}
                                </span>
                                {ItemIcon && !hideOptionIcons && (
                                  <ItemIcon className="size-3.5 shrink-0 text-stone-500/80" />
                                )}
                                <span className="flex-1 text-left whitespace-nowrap">
                                  {item.label}
                                </span>
                              </Button>
                            );
                          })}
                        </div>
                      );
                    }
                    continue;
                  }

                  const isChecked = selectedValues.includes(value);
                  elements.push(
                    <Button
                      key={value}
                      variant="ghost"
                      onClick={() => handleCheckedChange(value)}
                      className="relative flex w-full cursor-pointer items-center justify-start gap-2 rounded-lg px-2.5 py-2 text-start text-xs font-semibold text-stone-300 transition-all outline-none select-none hover:bg-stone-900 hover:text-stone-100"
                    >
                      <span className="inline-flex size-4 shrink-0 items-center justify-center">
                        {isChecked && <Check className="text-accent size-3.5" />}
                      </span>
                      {Icon && !hideOptionIcons && (
                        <Icon className="size-4 shrink-0 text-stone-400/80" />
                      )}
                      <span className="truncate">{optionLabel}</span>
                    </Button>
                  );
                  renderedValues.add(value);
                }

                return elements;
              })()}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
