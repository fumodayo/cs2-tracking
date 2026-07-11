/* eslint-disable react-refresh/only-export-components */
import { Clock3, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDateTimeVi as formatHistoryDate } from '@/utils/date';
import { useCurrency } from '@/components/currency-provider';
import { Tooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import type { PostAnalysisHistoryItemDto } from '@/types/post-analysis';

export function getHistorySnippet(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function HistoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-stone-850 min-w-0 rounded-lg border bg-stone-950/60 px-2.5 py-2 text-center shadow-sm">
      <div className="truncate text-[9px] font-semibold tracking-wider text-stone-500 uppercase">
        {label}
      </div>
      <div className="mt-1 truncate text-xs font-bold text-stone-100">{value}</div>
    </div>
  );
}

export function HistoryRow({
  item,
  selected,
  onLoad,
  onDelete,
}: {
  item: PostAnalysisHistoryItemDto;
  selected: boolean;
  onLoad: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  return (
    <div
      className={`group relative rounded-xl border p-4 transition-all duration-205 ${
        selected
          ? 'border-accent/50 bg-accent/3 shadow-accent/5 shadow-md'
          : 'border-stone-800 bg-stone-900/20 hover:border-stone-700 hover:bg-stone-900/30'
      }`}
    >
      <button
        type="button"
        onClick={onLoad}
        className="block w-full cursor-pointer text-left focus:outline-none"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <Clock3 className="size-3.5" />
            <span>{formatHistoryDate(item.updatedAt)}</span>
          </div>
          {selected && (
            <span className="bg-accent/10 text-accent rounded px-1.5 py-0.5 text-[10px] font-bold">
              {t('postAnalyzer.viewing')}
            </span>
          )}
        </div>
        <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed font-medium text-stone-300 group-hover:text-stone-200">
          {getHistorySnippet(item.text) || t('postAnalyzer.noContent')}
        </p>
        {item.imageFileName ? (
          <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-stone-500">
            <span className="size-1 rounded-full bg-stone-700" />
            {t('postAnalyzer.imageLabel')}: {item.imageFileName}
          </p>
        ) : null}
        <div className="mt-3.5 grid grid-cols-3 gap-2 text-xs">
          <HistoryMetric
            label={t('postAnalyzer.items')}
            value={new Intl.NumberFormat('vi-VN').format(item.analysis.totalQuantity)}
          />
          <HistoryMetric label={t('postAnalyzer.rate')} value={item.analysis.allRate.toFixed(2)} />
          <HistoryMetric
            label={t('postAnalyzer.total')}
            value={formatCurrency(item.analysis.totalAllRateValue)}
          />
        </div>
      </button>
      {onDelete && (
        <div className="absolute top-3.5 right-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <Tooltip content={t('postAnalyzer.deleteThisPost')}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="hover:border-danger-border hover:bg-danger-muted hover:text-danger size-7 rounded-md border border-stone-800 bg-stone-950/80 text-stone-400 transition-colors"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
