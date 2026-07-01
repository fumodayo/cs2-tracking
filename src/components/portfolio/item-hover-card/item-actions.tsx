'use client';

import React, { useState } from 'react';
import { Loader2, Trash2, TrendingUp, Coins, RotateCcw, Save, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PortfolioTableRow } from '../portfolio-table-model';
import { useTranslation } from 'react-i18next';

interface ItemActionsProps {
  item: PortfolioTableRow;
  relatedRows: PortfolioTableRow[];
  showBuffButton: boolean;
  hasBuffPrice: boolean;
  isLoadingBuff: boolean;
  deletingId?: string | null;
  saving: boolean;
  isDefault: boolean;
  embedded: boolean;
  fetchBuffPrice?: (marketHashName: string) => void;
  onUpdateBuffPrice?: (marketHashName: string, priceCny: number | null) => void;
  onDelete?: (id: string) => void;
  onReset: () => void;
  onSubmit: () => void;
  isSwitchingToSteam?: boolean;
  onSellItem?: (id: string) => void;
  onSellAll?: () => void;
  onDeleteAll?: () => void;
}

export function ItemActions({
  item,
  relatedRows,
  showBuffButton,
  hasBuffPrice,
  isLoadingBuff,
  deletingId,
  saving,
  isDefault,
  embedded,
  fetchBuffPrice,
  onUpdateBuffPrice,
  onDelete,
  onReset,
  onSubmit,
  isSwitchingToSteam = false,
  onSellItem,
  onSellAll,
  onDeleteAll,
}: ItemActionsProps) {
  const { t } = useTranslation();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [localSwitchingSteam, setLocalSwitchingSteam] = useState(false);
  const switchingToSteam = isSwitchingToSteam || localSwitchingSteam;

  const handleSwitchToSteam = async () => {
    if (!onUpdateBuffPrice) return;
    setLocalSwitchingSteam(true);
    try {
      await onUpdateBuffPrice(item.case.marketHashName, null);
    } finally {
      setLocalSwitchingSteam(false);
    }
  };

  return (
    <div
      className={`border-t border-stone-800/80 ${
        embedded
          ? 'sticky bottom-0 z-10 bg-stone-950/95 px-2 py-3 backdrop-blur-md'
          : 'rounded-b-2xl bg-stone-950/45 p-3.5'
      }`}
    >
      {relatedRows.length > 1 ? (
        <div className="flex w-full gap-2">
          {onSellItem && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSellItem(item.id)}
              className="text-emerald-450 flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-emerald-500/20 bg-emerald-500/5 text-[11px] font-extrabold transition-all duration-200 hover:border-emerald-500/40 hover:bg-emerald-500/10"
            >
              <TrendingUp className="text-emerald-455 size-3.5" />
              <span>{t('portfolio.sellItem', 'Bán')}</span>
            </Button>
          )}

          {showBuffButton && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fetchBuffPrice?.(item.case.marketHashName)}
              disabled={isLoadingBuff}
              className="text-amber-550 flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-amber-500/20 bg-amber-500/5 text-[11px] font-extrabold transition-all duration-200 hover:border-amber-500/40 hover:bg-amber-500/10 disabled:cursor-wait dark:text-amber-400"
            >
              {isLoadingBuff ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Coins className="text-amber-550 size-3.5 dark:text-amber-400" />
              )}
              <span>
                {embedded
                  ? t('portfolio.pricingBuff', 'Giá Buff')
                  : t('portfolio.fetchBuffPrice', 'BUFF Price')}
              </span>
            </Button>
          )}

          {hasBuffPrice && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSwitchToSteam}
              disabled={switchingToSteam}
              className="text-sky-450 flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-sky-500/20 bg-sky-500/5 text-[11px] font-extrabold transition-all duration-200 hover:border-sky-500/45 hover:bg-sky-500/10 disabled:cursor-wait dark:text-sky-400"
            >
              {switchingToSteam ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <DollarSign className="text-sky-450 size-3.5 dark:text-sky-400" />
              )}
              <span>{t('portfolio.pricingSteam', 'Steam Price')}</span>
            </Button>
          )}

          {onSellAll && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSellAll}
              className="text-emerald-450 flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-emerald-500/25 bg-emerald-500/5 text-[11px] font-extrabold transition-all duration-200 hover:border-emerald-500/45 hover:bg-emerald-500/10"
            >
              <TrendingUp className="text-emerald-455 size-3.5" />
              <span>{t('portfolio.sellAll', 'Bán tất cả')}</span>
            </Button>
          )}

          {onDeleteAll && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDeleteAll}
              className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-rose-500/20 bg-rose-500/5 text-[11px] font-extrabold text-rose-500 transition-all duration-200 hover:border-rose-500/40 hover:bg-rose-500/10 dark:text-rose-400"
            >
              <Trash2 className="size-3.5 text-rose-500 dark:text-rose-400" />
              <span>{t('portfolio.deleteAll', 'Xóa tất cả')}</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="flex w-full items-center justify-end gap-1.5">
          {/* Left side actions (Icon-only for compact premium UI) */}
          <div className="mr-auto flex items-center gap-1.5">
            {onDelete && (
              <Button
                type="button"
                variant="danger"
                size="icon"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={deletingId === item.id}
                title={t('common.delete', 'Delete')}
                className="flex size-9 cursor-pointer items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-500 transition-all duration-200 hover:border-rose-500/40 hover:bg-rose-500/15"
              >
                {deletingId === item.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onReset}
              disabled={isDefault}
              title={t('portfolio.clearDraft', 'Clear draft')}
              className="border-stone-850 disabled:border-stone-850 flex size-9 cursor-pointer items-center justify-center rounded-xl border bg-stone-900/10 text-stone-400 transition-all duration-200 hover:border-stone-700 hover:bg-stone-900/35 hover:text-stone-300 disabled:scale-100 disabled:bg-stone-900/5 disabled:text-stone-600 disabled:opacity-50 disabled:shadow-none"
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-1.5">
            {showBuffButton && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fetchBuffPrice?.(item.case.marketHashName)}
                disabled={isLoadingBuff}
                className="flex h-9 cursor-pointer items-center gap-1 rounded-xl border border-amber-500/20 bg-amber-500/5 px-2.5 text-[11px] font-bold text-amber-500 transition-all duration-200 hover:border-amber-500/40 hover:bg-amber-500/10 disabled:cursor-wait"
              >
                {isLoadingBuff ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Coins className="size-3.5 text-amber-500" />
                )}
                <span>{t('portfolio.pricingBuff', 'Giá Buff')}</span>
              </Button>
            )}

            {hasBuffPrice && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSwitchToSteam}
                disabled={switchingToSteam}
                className="flex h-9 cursor-pointer items-center gap-1 rounded-xl border border-sky-500/20 bg-sky-500/5 px-2.5 text-[11px] font-bold text-sky-400 transition-all duration-200 hover:border-sky-500/45 hover:bg-sky-500/10 disabled:cursor-wait"
              >
                {switchingToSteam ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <DollarSign className="size-3.5 text-sky-400" />
                )}
                <span>{t('portfolio.pricingSteam', 'Steam Price')}</span>
              </Button>
            )}

            {onSellItem && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSellItem(item.id)}
                className="flex h-9 cursor-pointer items-center gap-1 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-2.5 text-[11px] font-bold text-emerald-400 transition-all duration-200 hover:border-emerald-500/40 hover:bg-emerald-500/10"
              >
                <TrendingUp className="size-3.5 text-emerald-400" />
                <span>{t('portfolio.sellItem', 'Bán')}</span>
              </Button>
            )}

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onSubmit}
              disabled={saving || isDefault}
              className="bg-accent hover:bg-accent-hover flex h-9 cursor-pointer items-center gap-1 rounded-xl px-3 text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(59,130,246,0.18)] transition-all duration-200 hover:scale-[1.01] hover:shadow-[0_4px_16px_rgba(59,130,246,0.32)] active:scale-[0.98] disabled:scale-100 disabled:bg-stone-900/40 disabled:text-stone-500 disabled:opacity-50 disabled:shadow-none"
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              <span>{embedded ? t('common.save', 'Lưu') : t('portfolio.saveChanges', 'Lưu')}</span>
            </Button>
          </div>
        </div>
      )}

      {onDelete && (
        <ConfirmDialog
          open={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          title={t('portfolio.confirmDeleteItemTitle', 'Confirm delete item')}
          description={t(
            'portfolio.confirmDeleteItemDesc',
            'Are you sure you want to delete the item "{{name}}" from your portfolio? This action cannot be undone.',
            { name: item.case.name }
          )}
          confirmText={t('portfolio.confirmDeleteButton', 'Yes, delete')}
          cancelText={t('common.cancel', 'Cancel')}
          variant="danger"
          onConfirm={async () => {
            if (onDelete) {
              const targetId = relatedRows.length === 1 ? relatedRows[0].id : item.id;
              await onDelete(targetId);
            }
          }}
        />
      )}
    </div>
  );
}
