"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { format, subDays, startOfDay, isAfter } from "date-fns";
import { vi, enUS } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/cn";

interface DatePickerProps {
  value?: string; // Format: YYYY-MM-DD
  onChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export function DatePicker({
  value,
  onChange,
  className,
  disabled = false,
  id,
}: DatePickerProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = React.useState(false);

  // Parse string value (YYYY-MM-DD) to Date object, fallback to undefined
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }, [value]);

  const activeLocale = i18n.language === "vi" ? vi : enUS;

  // Track the month currently displayed in the calendar
  const [displayedMonth, setDisplayedMonth] = React.useState<Date>(new Date());

  // Sync displayed month when value changes
  React.useEffect(() => {
    if (selectedDate) {
      setDisplayedMonth(selectedDate);
    } else {
      setDisplayedMonth(new Date());
    }
  }, [selectedDate]);

  // Format date for display in the button trigger
  const displayValue = React.useMemo(() => {
    if (!selectedDate) {
      return i18n.language === "vi" ? "Chọn ngày..." : "Select date...";
    }
    return format(selectedDate, "dd/MM/yyyy", { locale: activeLocale });
  }, [selectedDate, i18n.language, activeLocale]);

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    
    // Check if the selected date is in the future
    const today = startOfDay(new Date());
    if (isAfter(startOfDay(date), today)) return;

    const formatted = format(date, "yyyy-MM-dd");
    onChange?.(formatted);
    setOpen(false); // Closes when user clicks directly on a calendar day
  };

  // Preset handlers (updates value and shifts month view, but keeps popover open)
  const handlePreset = (daysAgo: number) => {
    const targetDate = subDays(new Date(), daysAgo);
    const today = startOfDay(new Date());
    if (isAfter(startOfDay(targetDate), today)) return;

    const formatted = format(targetDate, "yyyy-MM-dd");
    onChange?.(formatted);
    setDisplayedMonth(targetDate); // Shifts month view to targetDate month
  };

  const presets = [
    {
      label: i18n.language === "vi" ? "Hôm nay" : "Today",
      value: 0,
    },
    {
      label: i18n.language === "vi" ? "Hôm qua" : "Yesterday",
      value: 1,
    },
    {
      label: i18n.language === "vi" ? "1 tuần trước" : "1 week ago",
      value: 7,
    },
    {
      label: i18n.language === "vi" ? "15 ngày trước" : "15 days ago",
      value: 15,
    },
    {
      label: i18n.language === "vi" ? "1 tháng trước" : "1 month ago",
      value: 30,
    },
  ];

  const defaultClassNames = getDefaultClassNames();

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full cursor-pointer items-center justify-between rounded-xl border border-input bg-card px-3 text-sm text-foreground shadow-sm transition-all duration-200 outline-none hover:border-accent/40 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50",
            !selectedDate && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{displayValue}</span>
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="animate-fade-slide-in z-50 flex w-[436px] flex-row items-stretch overflow-hidden rounded-2xl border border-border bg-popover/98 p-4 text-popover-foreground shadow-2xl backdrop-blur-md"
        >
          {/* Quick Presets Column */}
          <div className="flex flex-col gap-1.5 w-[135px] pr-3.5 border-r border-border/40 shrink-0">
            {presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => handlePreset(preset.value)}
                className="w-full text-left cursor-pointer rounded-lg border border-border/60 bg-surface-muted/5 py-1.5 px-2.5 text-[11px] font-medium text-muted-foreground transition-all duration-200 hover:-translate-x-[2px] hover:border-accent/40 hover:bg-accent/5 hover:text-accent active:translate-x-0 whitespace-nowrap"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Calendar Picker */}
          <div className="pl-4 flex-1">
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={handleSelect}
              month={displayedMonth}
              onMonthChange={setDisplayedMonth}
              locale={activeLocale}
              disabled={{ after: new Date() }}
              classNames={{
                ...defaultClassNames,
                root: cn(defaultClassNames.root, "font-sans p-0 m-0"),
                chevron: "fill-muted-foreground",
              }}
              components={{
                Chevron: (props) => {
                  if (props.orientation === "left") {
                    return <ChevronLeft className="size-4 shrink-0" />;
                  }
                  return <ChevronRight className="size-4 shrink-0" />;
                }
              }}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
