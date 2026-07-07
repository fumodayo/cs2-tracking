/* eslint-disable react-refresh/only-export-components */
import { type ColumnDef, type HeaderContext } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { cn } from '@/utils/cn';
import { FaSteam, FaCoins } from 'react-icons/fa';
import { TbLock } from 'react-icons/tb';
import type { PortfolioReportRowDto } from '@/types/report';
import { formatPercent } from '@/utils/format';
import { formatRelative as formatRelativeTime } from '@/utils/date';
import {
  type PortfolioTableMode,
  type PortfolioTableRow,
  mapTransactionRow,
} from './portfolio-table-model';
import { getBuyDateSortValue, calculateRatedValue, toInputNumber } from './portfolio-table-utils';
import { RatedValueCell } from './portfolio-table-cells';
import { estimateOverpay } from '@/services/pattern/overpay-calculator';

import { DataTableColumnHeader } from '@/components/ui/actions';

export function sortableHeader(
  label: string,
  align: 'left' | 'right' = 'left',
  isMobile?: boolean
) {
  function SortableHeader({ column }: HeaderContext<PortfolioTableRow, unknown>) {
    return (
      <DataTableColumnHeader column={column} title={label} align={align} isMobile={isMobile} />
    );
  }

  SortableHeader.displayName = `SortableHeader(${label})`;
  return SortableHeader;
}

export function RateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="border-border bg-input text-muted-foreground focus-within:border-ring focus-within:ring-ring flex h-9 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs transition-all focus-within:ring-1 hover:border-stone-700">
      <span className="font-semibold text-stone-400">{label}:</span>
      <input
        type="number"
        min="0"
        max="100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="text-foreground h-7 w-8 [appearance:textfield] bg-transparent text-center text-xs font-bold outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="font-semibold opacity-70">%</span>
    </label>
  );
}

// Forward declaration — ItemCell is in portfolio-item-cell.tsx
// This import is here for circular-dependency avoidance; caller passes ItemCell as a render prop.
export type BuildColumnsParams = {
  t: TFunction;
  mode: PortfolioTableMode;
  deletingId: string | null;
  onDelete: (id: string) => void;
  updatingId?: string | null;
  onUpdateBuyPrice?: (id: string, buyPrice: number) => Promise<void> | void;
  onUpdateQuantity?: (id: string, quantity: number) => Promise<void> | void;
  onUpdateNote?: (id: string, note: string) => Promise<void> | void;
  onUpdateLot?: (
    id: string,
    payload: {
      quantity?: number;
      buyPrice?: number;
      note?: string;
      sourceAccounts?: Array<{ steamId64: string; name: string }>;
      storageUnitId?: string;
      tradeHoldUntil?: string | null;
    }
  ) => Promise<void> | void;
  buffPricesCny?: Record<string, number>;
  buffCnyToVndRate?: number;
  onUpdateBuffPrice?: (marketHashName: string, priceCny: number | null) => void;
  fetchBuffPrice?: (marketHashName: string) => void;
  buffLoadingKeys?: Set<string>;
  allRows: PortfolioTableRow[];
  originalRows?: PortfolioReportRowDto[];
  wholesaleRatePercent: number;
  retailRatePercent: number;
  onUpdateBuffRate?: (rate: number) => void;
  formatCurrency: (value: number | null | undefined) => string;
  onSellItem?: (id: string) => void;
  ItemCellComponent: React.ComponentType<{
    item: PortfolioTableRow;
    mode: PortfolioTableMode;
    relatedRows: PortfolioTableRow[];
    isSelected?: boolean;
    onToggleSelect?: () => void;
    onUpdateQuantity?: (id: string, quantity: number) => Promise<void> | void;
    onUpdateBuyPrice?: (id: string, buyPrice: number) => Promise<void> | void;
    onUpdateNote?: (id: string, note: string) => Promise<void> | void;
    onUpdateLot?: BuildColumnsParams['onUpdateLot'];
    onUpdateBuffRate?: (rate: number) => void;
    fetchBuffPrice?: (marketHashName: string) => void;
    buffLoadingKeys?: Set<string>;
    buffCnyToVndRate?: number;
    buffPricesCny?: Record<string, number>;
    onUpdateBuffPrice?: (marketHashName: string, priceCny: number | null) => void;
    onDelete: (id: string) => void;
    deletingId: string | null;
    onSellItem?: (id: string) => void;
  }>;
  isMobile?: boolean;
};

export function buildColumns({
  t,
  mode,
  deletingId,
  onDelete,
  onUpdateBuyPrice,
  onUpdateQuantity,
  onUpdateNote,
  onUpdateLot,
  onUpdateBuffRate,
  buffPricesCny,
  buffCnyToVndRate,
  onUpdateBuffPrice,
  fetchBuffPrice,
  buffLoadingKeys,
  originalRows,
  wholesaleRatePercent,
  retailRatePercent,
  formatCurrency,
  onSellItem,
  ItemCellComponent,
  isMobile = false,
}: BuildColumnsParams): ColumnDef<PortfolioTableRow>[] {
  return [
    {
      id: 'case',
      enableHiding: false,
      header: t('inventoryScanner.item', 'Item'),
      accessorFn: (row) => row.case.name,
      cell: ({ row }) => {
        const item = row.original;
        const relatedRows =
          mode === 'case-summary' && originalRows
            ? originalRows
                .filter((candidate) => candidate.case.id === item.case.id)
                .map((candidate) => mapTransactionRow(candidate, buffPricesCny, buffCnyToVndRate))
            : [item];
        return (
          <ItemCellComponent
            item={item}
            mode={mode}
            relatedRows={relatedRows}
            isSelected={row.getIsSelected()}
            onToggleSelect={() => row.toggleSelected(!row.getIsSelected())}
            onUpdateQuantity={onUpdateQuantity}
            onUpdateBuyPrice={onUpdateBuyPrice}
            onUpdateNote={onUpdateNote}
            onUpdateLot={onUpdateLot}
            onUpdateBuffRate={onUpdateBuffRate}
            fetchBuffPrice={fetchBuffPrice}
            buffLoadingKeys={buffLoadingKeys}
            buffCnyToVndRate={buffCnyToVndRate}
            buffPricesCny={buffPricesCny}
            onUpdateBuffPrice={onUpdateBuffPrice}
            onDelete={onDelete}
            deletingId={deletingId}
            onSellItem={onSellItem}
          />
        );
      },
    },
    {
      id: 'quantity',
      enableHiding: false,
      header: sortableHeader('SL', 'right', isMobile),
      accessorFn: (row) => row.quantity,
      cell: ({ row }) => {
        const item = row.original;
        const total = item.quantity;
        const suQty = item.storageUnitQuantity ?? 0;
        const invQty = total - suQty;
        return (
          <div className="flex flex-col items-end">
            <span className="text-foreground font-medium">{total}</span>
            {suQty > 0 && (
              <span
                className="mt-0.5 inline-flex cursor-help items-center gap-0.5 rounded border border-amber-500/20 bg-amber-500/10 px-1 text-[9px] font-bold text-amber-400 select-none"
                title={t(
                  'portfolio.quantityTooltip',
                  'Inventory: {{invQty}} | Storage Unit: {{suQty}}',
                  { invQty, suQty }
                )}
                aria-label={t(
                  'portfolio.quantityTooltip',
                  'Inventory: {{invQty}} | Storage Unit: {{suQty}}',
                  { invQty, suQty }
                )}
              >
                <TbLock className="size-2.5 shrink-0" /> {suQty}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'buyPrice',
      header: sortableHeader(t('portfolio.buyPrice', 'Buy Price'), 'right', isMobile),
      accessorFn: (row) => row.buyPrice,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-foreground flex items-center justify-end gap-1 font-medium">
              {formatCurrency(item.buyPrice)}
            </span>
          </div>
        );
      },
    },
    {
      id: 'investedValue',
      header: sortableHeader(t('portfolio.investedValue', 'Invested Value'), 'right', isMobile),
      accessorFn: (row) => row.investedValue,
      cell: ({ row }) => (
        <span className="font-medium">{formatCurrency(row.original.investedValue)}</span>
      ),
    },
    {
      id: 'currentPrice',
      header: sortableHeader(t('portfolio.currentPrice', 'Current Price'), 'right', isMobile),
      accessorFn: (row) => row.currentPrice ?? -1,
      cell: ({ row }) => {
        const item = row.original;
        const marketHashName = item.case.marketHashName;
        const buffPriceCny = buffPricesCny ? buffPricesCny[marketHashName] : undefined;
        const rate = buffCnyToVndRate || 3600;
        const steamVal = item.steamPrice ?? item.currentPrice;
        const hasBuffPrice = buffPriceCny !== undefined && buffPriceCny > 0;

        const overpayInfo =
          item.patternInfo && buffPriceCny !== undefined && buffPriceCny > 0
            ? estimateOverpay(item.patternInfo, buffPriceCny)
            : null;

        return (
          <div className="flex min-h-[3rem] flex-col items-end justify-center gap-1 py-1">
            {/* Steam Price */}
            <div className="group relative flex cursor-help items-center gap-1.5">
              <span className="text-foreground text-[13px] font-medium">
                {formatCurrency(steamVal)}
              </span>
              <FaSteam className="size-3.5 text-slate-400 transition-colors group-hover:text-sky-400" />

              {/* Premium Tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded border border-slate-800/80 bg-slate-950 px-2 py-1 text-[10px] font-medium whitespace-nowrap text-slate-200 opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-200 group-hover:opacity-100">
                {t('portfolio.steamPriceTooltip', 'Steam Price')}
              </div>
            </div>

            {/* Buff Price */}
            {hasBuffPrice && (
              <div
                className={cn(
                  'group relative flex cursor-help transition-colors hover:text-blue-300',
                  isMobile ? 'flex-col items-end gap-0.5' : 'items-center gap-1.5'
                )}
              >
                <span
                  className={cn(
                    'text-right font-medium',
                    overpayInfo ? 'text-emerald-400' : 'text-accent',
                    isMobile
                      ? 'flex flex-col items-end text-[11px]'
                      : 'text-[13px] group-hover:underline'
                  )}
                >
                  <span>
                    {formatCurrency(
                      Math.round((overpayInfo ? overpayInfo.estimatedTypical : buffPriceCny) * rate)
                    )}
                  </span>
                  {isMobile ? (
                    <span className="flex flex-col items-end font-sans text-[9px] leading-tight font-normal text-stone-500">
                      <span>
                        ¥
                        {new Intl.NumberFormat('vi-VN').format(
                          overpayInfo ? overpayInfo.estimatedTypical : buffPriceCny
                        )}
                      </span>
                      <span>x {new Intl.NumberFormat('vi-VN').format(rate)}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground ml-1 text-[10px] font-normal">
                      (
                      {new Intl.NumberFormat('vi-VN').format(
                        overpayInfo ? overpayInfo.estimatedTypical : buffPriceCny
                      )}{' '}
                      x {new Intl.NumberFormat('vi-VN').format(rate)})
                    </span>
                  )}
                </span>
                {!isMobile && (
                  <FaCoins
                    className={cn(
                      'transition-transform group-hover:scale-110',
                      overpayInfo ? 'text-emerald-400' : 'text-accent',
                      'size-3.5'
                    )}
                  />
                )}

                {/* Premium Tooltip */}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded border border-slate-800/80 bg-slate-950 px-2 py-1 text-[10px] font-medium whitespace-nowrap text-slate-200 opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-200 group-hover:opacity-100">
                  {overpayInfo
                    ? `${t('portfolio.buffPriceTooltip', 'Buff Price')} + Overpay (${overpayInfo.multiplierSource})`
                    : t('portfolio.buffPriceTooltip', 'Buff Price (¥{{buffPrice}} × {{rate}})', {
                        buffPrice: new Intl.NumberFormat('vi-VN').format(buffPriceCny),
                        rate: new Intl.NumberFormat('vi-VN').format(rate),
                      })}
                </div>
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'wholesaleValue',
      header: sortableHeader(
        `${t('portfolio.wholesaleLabel', 'Wholesale')} ${toInputNumber(wholesaleRatePercent)}%`,
        'right',
        isMobile
      ),
      accessorFn: (row) => calculateRatedValue(row, wholesaleRatePercent) ?? -1,
      cell: ({ row }) => (
        <RatedValueCell
          item={row.original}
          ratePercent={wholesaleRatePercent}
          label={t('portfolio.wholesaleLabel', 'Wholesale')}
        />
      ),
    },
    {
      id: 'retailValue',
      header: sortableHeader(
        `${t('portfolio.retailLabel', 'Retail')} ${toInputNumber(retailRatePercent)}%`,
        'right',
        isMobile
      ),
      accessorFn: (row) => calculateRatedValue(row, retailRatePercent) ?? -1,
      cell: ({ row }) => (
        <RatedValueCell
          item={row.original}
          ratePercent={retailRatePercent}
          label={t('portfolio.retailLabel', 'Retail')}
        />
      ),
    },
    {
      id: 'profitAmount',
      header: sortableHeader(t('portfolio.profit', 'Profit'), 'right', isMobile),
      accessorFn: (row) => row.profitAmount ?? -Number.MAX_SAFE_INTEGER,
      cell: ({ row }) => {
        const item = row.original;
        const profitPositive = (item.profitAmount ?? 0) >= 0;
        const marketHashName = item.case.marketHashName;
        const buffPriceCny = buffPricesCny ? buffPricesCny[marketHashName] : undefined;
        const hasBuffPrice =
          buffPriceCny !== undefined && buffPriceCny > 0 && item.itemType === 'skin';

        return (
          <div className="flex flex-col items-end gap-1">
            <span
              className={`font-semibold ${profitPositive ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {formatCurrency(item.profitAmount)}
            </span>
            {hasBuffPrice ? (
              <span className="bg-accent/10 text-accent inline-flex rounded px-1 py-0.5 text-[8.5px] font-semibold tracking-wider uppercase">
                {t('portfolio.buffValuation', 'BUFF Valuation')}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'profitPercent',
      header: sortableHeader('%', 'right', isMobile),
      accessorFn: (row) => row.profitPercent ?? -Number.MAX_SAFE_INTEGER,
      cell: ({ row }) => {
        const item = row.original;
        const profitPositive = (item.profitPercent ?? 0) >= 0;
        return (
          <span className={`font-semibold ${profitPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatPercent(item.profitPercent)}
          </span>
        );
      },
    },
    {
      id: 'updatedAt',
      header: sortableHeader(t('portfolio.updatedAt', 'Updated At'), 'right', isMobile),
      accessorFn: (row) =>
        row.currentPriceCapturedAt ? new Date(row.currentPriceCapturedAt).getTime() : 0,
      cell: ({ row }) => {
        const dateVal = row.original.currentPriceCapturedAt;
        return (
          <span className="text-muted-foreground text-right text-[13px] font-medium">
            {formatRelativeTime(dateVal)}
          </span>
        );
      },
    },
    {
      id: 'buyDate',
      header: sortableHeader(
        mode === 'case-summary'
          ? t('portfolio.buyInterval', 'Buy Range')
          : t('portfolio.buyDate', 'Buy Date'),
        'right',
        isMobile
      ),
      accessorFn: (row) => getBuyDateSortValue(row.buyDate),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-right text-[13px] font-medium">
          {formatRelativeTime(row.original.buyDate)}
        </span>
      ),
    },
  ];
}
