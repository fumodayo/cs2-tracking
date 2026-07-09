import { Column } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-is-mobile';

interface DataTableColumnHeaderProps<TData, TValue> extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
  align?: 'left' | 'right';
  isMobile?: boolean;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  align = 'left',
  className,
  isMobile: isMobileProp,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const { t } = useTranslation();
  const isMobileState = useIsMobile();
  const isMobile = isMobileProp ?? isMobileState;

  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  const isSorted = column.getIsSorted();

  const handleSort = () => {
    if (!isSorted) {
      column.toggleSorting(true); // Lần bấm 1: giảm dần
    } else if (isSorted === 'desc') {
      column.toggleSorting(false); // Lần bấm 2: tăng dần
    } else {
      column.clearSorting(); // Lần bấm 3: xóa sắp xếp
    }
  };

  if (isMobile) {
    return (
      <div className={cn('flex items-center', align === 'right' && 'justify-end', className)}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSort}
          className={cn(
            '-mx-2 h-8 cursor-pointer px-2 font-medium hover:bg-stone-800/80 hover:text-white focus:outline-none',
            align === 'right' ? 'w-full justify-end text-right' : 'justify-start text-left'
          )}
        >
          <span>{title}</span>
          {isSorted === 'desc' ? (
            <ArrowDown className="text-accent ml-1 size-3 shrink-0" />
          ) : isSorted === 'asc' ? (
            <ArrowUp className="text-accent ml-1 size-3 shrink-0" />
          ) : (
            <ArrowUpDown className="ml-1 size-3 shrink-0 text-stone-500" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center', align === 'right' && 'justify-end', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              '-mx-2 h-8 cursor-pointer px-2 font-medium hover:bg-stone-800/80 hover:text-white focus:outline-none data-[state=open]:bg-stone-800/80',
              align === 'right' ? 'w-full justify-end text-right' : 'justify-start text-left'
            )}
          >
            <span>{title}</span>
            {isSorted === 'desc' ? (
              <ArrowDown className="text-accent ml-1 size-3 shrink-0" />
            ) : isSorted === 'asc' ? (
              <ArrowUp className="text-accent ml-1 size-3 shrink-0" />
            ) : (
              <ArrowUpDown className="ml-1 size-3 shrink-0 text-stone-500" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align === 'right' ? 'end' : 'start'}
          className="w-32 border-stone-800 bg-stone-950"
        >
          <DropdownMenuItem
            onClick={() => column.toggleSorting(false)}
            className="flex cursor-pointer items-center gap-2 text-stone-200 focus:bg-stone-900 focus:text-stone-100"
          >
            <ArrowUp className="size-3.5 text-stone-400" />
            <span>{t('common.sortAsc', 'Tăng dần')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => column.toggleSorting(true)}
            className="flex cursor-pointer items-center gap-2 text-stone-200 focus:bg-stone-900 focus:text-stone-100"
          >
            <ArrowDown className="size-3.5 text-stone-400" />
            <span>{t('common.sortDesc', 'Giảm dần')}</span>
          </DropdownMenuItem>
          {column.getCanHide() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => column.toggleVisibility(false)}
                className="flex cursor-pointer items-center gap-2 text-stone-200 focus:bg-stone-900 focus:text-stone-100"
              >
                <EyeOff className="size-3.5 text-stone-400" />
                <span>{t('common.hideColumn', 'Ẩn')}</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
