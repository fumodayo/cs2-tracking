'use client';

import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { format, subDays, startOfDay, isAfter } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, getDefaultClassNames } from 'react-day-picker';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';

interface DatePickerProps {
  value?: string; // Định dạng: YYYY-MM-DD
  onChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export function DatePicker({ value, onChange, className, disabled = false, id }: DatePickerProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = React.useState(false);

  // Parse chuỗi (YYYY-MM-DD) thành Date, fallback về undefined
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }, [value]);

  const activeLocale = i18n.language === 'vi' ? vi : enUS;

  // Theo dõi tháng đang hiển thị trong lịch
  const [displayedMonth, setDisplayedMonth] = React.useState<Date>(new Date());

  // Đồng bộ tháng hiển thị khi value thay đổi
  React.useEffect(() => {
    if (selectedDate) {
      setDisplayedMonth(selectedDate);
    } else {
      setDisplayedMonth(new Date());
    }
  }, [selectedDate]);

  // Định dạng ngày để hiển thị trong nút trigger
  const displayValue = React.useMemo(() => {
    if (!selectedDate) {
      return i18n.language === 'vi' ? 'Chọn ngày...' : 'Select date...';
    }
    return format(selectedDate, 'dd/MM/yyyy', { locale: activeLocale });
  }, [selectedDate, i18n.language, activeLocale]);

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;

    // Kiểm tra ngày được chọn có nằm trong tương lai không
    const today = startOfDay(new Date());
    if (isAfter(startOfDay(date), today)) return;

    const formatted = format(date, 'yyyy-MM-dd');
    onChange?.(formatted);
    setOpen(false); // Đóng khi user bấm trực tiếp vào một ngày trong lịch
  };

  // Handler preset (cập nhật value và đổi tháng đang xem, nhưng vẫn giữ popover mở)
  const handlePreset = (daysAgo: number) => {
    const targetDate = subDays(new Date(), daysAgo);
    const today = startOfDay(new Date());
    if (isAfter(startOfDay(targetDate), today)) return;

    const formatted = format(targetDate, 'yyyy-MM-dd');
    onChange?.(formatted);
    setDisplayedMonth(targetDate); // Chuyển tháng đang xem sang tháng của targetDate.
  };

  const presets = [
    {
      label: i18n.language === 'vi' ? 'Hôm nay' : 'Today',
      value: 0,
    },
    {
      label: i18n.language === 'vi' ? 'Hôm qua' : 'Yesterday',
      value: 1,
    },
    {
      label: i18n.language === 'vi' ? '1 tuần trước' : '1 week ago',
      value: 7,
    },
    {
      label: i18n.language === 'vi' ? '15 ngày trước' : '15 days ago',
      value: 15,
    },
    {
      label: i18n.language === 'vi' ? '1 tháng trước' : '1 month ago',
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
            'border-input bg-card text-foreground hover:border-accent/40 focus:border-accent focus:ring-accent/20 flex h-10 w-full cursor-pointer items-center justify-between rounded-xl border px-3 text-sm shadow-sm transition-all duration-200 outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
            !selectedDate && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">{displayValue}</span>
          <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="animate-fade-slide-in border-border bg-popover/98 text-popover-foreground z-50 flex w-[436px] flex-row items-stretch overflow-hidden rounded-2xl border p-4 shadow-2xl backdrop-blur-md"
        >
          {/* Cột preset nhanh */}
          <div className="border-border/40 flex w-[135px] shrink-0 flex-col gap-1.5 border-r pr-3.5">
            {presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => handlePreset(preset.value)}
                className="border-border/60 bg-surface-muted/5 text-muted-foreground hover:border-accent/40 hover:bg-accent/5 hover:text-accent w-full cursor-pointer rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-medium whitespace-nowrap transition-all duration-200 hover:-translate-x-[2px] active:translate-x-0"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Bộ chọn lịch */}
          <div className="flex-1 pl-4">
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
                root: cn(defaultClassNames.root, 'font-sans p-0 m-0'),
                chevron: 'fill-muted-foreground',
              }}
              components={{
                Chevron: (props) => {
                  if (props.orientation === 'left') {
                    return <ChevronLeft className="size-4 shrink-0" />;
                  }
                  return <ChevronRight className="size-4 shrink-0" />;
                },
              }}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
