'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Archive, ArrowRightLeft, Trash2, HelpCircle, PlusCircle, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MissingItemsDialogItemCell } from './components/missing-items-dialog-item-cell';
import type { ExtraItem, MissingItem, SyncStorageUnit } from './missing-items-dialog-types';

export type {
  AccountChangeDetail,
  ExtraItem,
  MissingItem,
  SyncStorageUnit,
} from './missing-items-dialog-types';

type Resolution = 'storage_unit' | 'traded' | 'deleted' | 'unknown';

type ItemResolution = {
  caseId: string;
  marketHashName: string;
  missingQuantity: number;
  resolution: Resolution;
  storageUnitId?: string;
};

type MissingItemsDialogProps = {
  open: boolean;
  onClose: () => void;
  missingItems: MissingItem[];
  extraItems?: ExtraItem[];
  storageUnits: SyncStorageUnit[];
  onResolve: (resolutions: ItemResolution[]) => Promise<void>;
};

export function MissingItemsDialog({
  open,
  onClose,
  missingItems,
  extraItems = [],
  storageUnits,
  onResolve,
}: MissingItemsDialogProps) {
  const { t } = useTranslation();
  const resolutionOptions = useMemo(
    () => [
      {
        value: 'storage_unit' as Resolution,
        label: t('missingItemsDialog.resolutionStorageUnit', 'Store in Storage Unit'),
        icon: Archive,
        color: 'text-amber-600 dark:text-amber-400',
      },
      {
        value: 'traded' as Resolution,
        label: t('missingItemsDialog.resolutionTraded', 'Traded'),
        icon: ArrowRightLeft,
        color: 'text-blue-600 dark:text-blue-400',
      },
      {
        value: 'deleted' as Resolution,
        label: t('missingItemsDialog.resolutionDeleted', 'Deleted'),
        icon: Trash2,
        color: 'text-red-650 dark:text-red-400',
      },
      {
        value: 'unknown' as Resolution,
        label: t('missingItemsDialog.resolutionUnknown', 'Unknown'),
        icon: HelpCircle,
        color: 'text-stone-500 dark:text-stone-400',
      },
    ],
    [t]
  );
  const [resolutions, setResolutions] = useState<
    Record<string, { resolution: Resolution; storageUnitId?: string }>
  >({});

  const [activeTab, setActiveTab] = useState<'missing' | 'extra'>('missing');
  const [submitting, setSubmitting] = useState(false);

  const getStorageUnitsForItem = useCallback(
    (item: MissingItem) => {
      const accountIds = new Set((item.accounts ?? []).map((account) => String(account.steamId64)));
      if (accountIds.size === 0) return storageUnits;
      return storageUnits.filter((unit) => accountIds.has(String(unit.steamId64)));
    },
    [storageUnits]
  );

  // Reset/khởi tạo state khi dialog mở hoặc items thay đổi
  useEffect(() => {
    if (open) {
      const initial: Record<string, { resolution: Resolution; storageUnitId?: string }> = {};
      for (const item of missingItems) {
        const itemStorageUnits = getStorageUnitsForItem(item);
        initial[item.caseId] = {
          resolution: itemStorageUnits.length > 0 ? 'storage_unit' : 'unknown',
          storageUnitId: itemStorageUnits[0]?.id,
        };
      }
      setResolutions(initial);
      setActiveTab(missingItems.length > 0 ? 'missing' : 'extra');
    }
  }, [open, missingItems, getStorageUnitsForItem]);

  if (!open || (missingItems.length === 0 && extraItems.length === 0)) return null;

  const showTabs = missingItems.length > 0 && extraItems.length > 0;

  // Tiêu đề và mô tả động
  let title = t('missingItemsDialog.defaultTitle', 'Steam Inventory Scan Results');
  let description = t(
    'missingItemsDialog.defaultDesc',
    'Detected changes in inventory item counts.'
  );

  if (!showTabs) {
    if (missingItems.length > 0) {
      title = t('missingItemsDialog.missingTitle', 'Detected {{count}} disappeared item types', {
        count: missingItems.length,
      });
      description = t(
        'missingItemsDialog.missingDesc',
        'The following items decreased in quantity compared to the last scan. Please specify where they went.'
      );
    } else if (extraItems.length > 0) {
      title = t('missingItemsDialog.extraTitle', 'Detected {{count}} new / increased item types', {
        count: extraItems.length,
      });
      description = t(
        'missingItemsDialog.extraDesc',
        'The following items increased in quantity or are new since the last scan. They have been automatically added to your portfolio.'
      );
    }
  } else {
    title = t('missingItemsDialog.syncTitle', 'Sync Inventory Changes');
    description = t(
      'missingItemsDialog.syncDesc',
      'Detected both disappeared and new/increased items in your inventory.'
    );
  }

  const handleSubmit = async () => {
    if (missingItems.length === 0) {
      onClose();
      return;
    }
    setSubmitting(true);
    try {
      const payload: ItemResolution[] = missingItems.map((item) => {
        const r = resolutions[item.caseId];
        return {
          caseId: item.caseId,
          marketHashName: item.marketHashName,
          missingQuantity: item.missingQuantity,
          resolution: r?.resolution ?? 'unknown',
          storageUnitId: r?.resolution === 'storage_unit' ? r.storageUnitId : undefined,
        };
      });
      await onResolve(payload);
      onClose();
    } catch (err) {
      console.error('Failed to resolve missing items:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="border-stone-850 text-foreground flex max-h-[88vh] max-w-4xl flex-col overflow-hidden bg-white p-8 shadow-xl backdrop-blur-3xl sm:rounded-2xl dark:bg-[#0c0f17]/98 dark:shadow-[0_30px_90px_rgba(0,0,0,0.95)]">
        {/* Phần đầu */}
        <DialogHeader className="mb-4">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <span
              className={`inline-flex size-9 items-center justify-center rounded-full ${
                activeTab === 'missing'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
              }`}
            >
              {activeTab === 'missing' ? (
                <Archive className="size-5" />
              ) : (
                <PlusCircle className="size-5" />
              )}
            </span>
            {title}
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
            {description}
          </DialogDescription>
        </DialogHeader>

        {/* Tab switchers if both exist */}
        {showTabs && (
          <div className="mb-5 flex shrink-0 justify-start">
            <div className="border-stone-850 relative inline-flex h-9 shrink-0 items-center rounded-lg border bg-stone-950 p-1 shadow-sm select-none">
              <button
                type="button"
                onClick={() => setActiveTab('missing')}
                className={`relative inline-flex h-7 cursor-pointer items-center justify-center rounded-md px-4 py-1 text-xs font-bold transition-all duration-200 ${
                  activeTab === 'missing'
                    ? 'text-accent-foreground'
                    : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                {activeTab === 'missing' && (
                  <motion.div
                    layoutId="activeMissingItemsTab"
                    className="bg-accent shadow-accent/15 absolute inset-0 rounded-md shadow-md"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">
                  {t('missingItemsDialog.tabMissing', 'Disappeared (Missing: {{count}})', {
                    count: missingItems.length,
                  })}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('extra')}
                className={`relative inline-flex h-7 cursor-pointer items-center justify-center rounded-md px-4 py-1 text-xs font-bold transition-all duration-200 ${
                  activeTab === 'extra'
                    ? 'text-accent-foreground'
                    : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                {activeTab === 'extra' && (
                  <motion.div
                    layoutId="activeMissingItemsTab"
                    className="bg-accent shadow-accent/15 absolute inset-0 rounded-md shadow-md"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">
                  {t('missingItemsDialog.tabExtra', 'New / Increased (Extra: {{count}})', {
                    count: extraItems.length,
                  })}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Table Container */}
        <div className="border-stone-850 bg-background/50 relative min-h-[250px] flex-grow overflow-y-auto rounded-xl border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-stone-850 sticky top-0 z-10 border-b bg-stone-950 text-xs font-bold tracking-wider text-stone-500 uppercase shadow-sm dark:bg-[#0e1220]">
              <tr>
                <th className="min-w-[260px] px-6 py-4">{t('missingItemsDialog.item', 'Item')}</th>
                <th className="w-36 px-6 py-4 text-center">
                  {t('missingItemsDialog.change', 'Change')}
                </th>
                <th className="w-[300px] px-6 py-4">
                  {activeTab === 'missing'
                    ? t('missingItemsDialog.resolution', 'Resolution')
                    : t('missingItemsDialog.status', 'Status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-stone-850 divide-y">
              {activeTab === 'missing' ? (
                missingItems.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-sm text-stone-500">
                      {t('missingItemsDialog.noMissingItems', 'No disappeared items')}
                    </td>
                  </tr>
                ) : (
                  missingItems.map((item) => {
                    const current = resolutions[item.caseId];
                    const itemStorageUnits = getStorageUnitsForItem(item);
                    return (
                      <tr
                        key={item.caseId}
                        className="hover:bg-surface-hover/30 transition-colors duration-150"
                      >
                        {/* Item Details */}
                        <td className="px-6 py-4">
                          <MissingItemsDialogItemCell item={item} tone="missing" />
                        </td>

                        {/* Quantity change */}
                        <td className="px-6 py-4 text-center">
                          <span className="text-red-650 text-lg font-black dark:text-red-400">
                            -{item.missingQuantity}
                          </span>
                          <span className="mt-1 block font-mono text-xs font-medium text-stone-500">
                            {item.previousQuantity} → {item.currentQuantity}
                          </span>
                        </td>

                        {/* Resolution drop downs */}
                        <td className="px-6 py-4">
                          <div className="flex max-w-[270px] flex-col gap-2">
                            <Select
                              value={current?.resolution ?? 'unknown'}
                              onValueChange={(val) => {
                                setResolutions((prev) => ({
                                  ...prev,
                                  [item.caseId]: {
                                    resolution: val as Resolution,
                                    storageUnitId:
                                      val === 'storage_unit'
                                        ? (prev[item.caseId]?.storageUnitId ??
                                          itemStorageUnits[0]?.id)
                                        : undefined,
                                  },
                                }));
                              }}
                            >
                              <Select.Trigger className="border-stone-850 focus:border-accent h-10 text-sm font-semibold">
                                <Select.Value />
                              </Select.Trigger>
                              <Select.Content className="text-foreground">
                                {resolutionOptions.map((opt) => {
                                  const Icon = opt.icon;
                                  return (
                                    <Select.Item key={opt.value} value={opt.value}>
                                      <div className="flex items-center gap-2.5 py-0.5">
                                        <Icon className={`size-4.5 ${opt.color}`} />
                                        <span className="text-sm font-semibold">{opt.label}</span>
                                      </div>
                                    </Select.Item>
                                  );
                                })}
                              </Select.Content>
                            </Select>

                            {/* Storage unit select, if storage_unit resolution is active */}
                            {current?.resolution === 'storage_unit' && (
                              <div className="w-full">
                                {itemStorageUnits.length > 0 ? (
                                  <Select
                                    value={current.storageUnitId ?? ''}
                                    onValueChange={(val) => {
                                      setResolutions((prev) => ({
                                        ...prev,
                                        [item.caseId]: {
                                          ...prev[item.caseId],
                                          storageUnitId: val,
                                        },
                                      }));
                                    }}
                                  >
                                    <Select.Trigger className="border-stone-850 focus:border-accent h-10 text-sm font-semibold">
                                      <Select.Value />
                                    </Select.Trigger>
                                    <Select.Content className="text-foreground">
                                      {itemStorageUnits.map((su) => (
                                        <Select.Item key={su.id} value={su.id}>
                                          <span className="text-sm font-semibold">
                                            {su.name} ({su.currentCount}/1000)
                                          </span>
                                        </Select.Item>
                                      ))}
                                    </Select.Content>
                                  </Select>
                                ) : (
                                  <p className="rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs leading-normal text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-400/80">
                                    {t(
                                      'missingItemsDialog.noStorageUnitsFound',
                                      'No Storage Units found in inventory.'
                                    )}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )
              ) : extraItems.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-sm text-stone-500">
                    {t('missingItemsDialog.noExtraItems', 'No new or increased items')}
                  </td>
                </tr>
              ) : (
                extraItems.map((item) => (
                  <tr
                    key={item.caseId}
                    className="hover:bg-surface-hover/30 transition-colors duration-150"
                  >
                    {/* Item Details */}
                    <td className="px-6 py-4">
                      <MissingItemsDialogItemCell item={item} tone="extra" />
                    </td>

                    {/* Quantity change */}
                    <td className="px-6 py-4 text-center">
                      <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                        +{item.extraQuantity}
                      </span>
                      <span className="mt-1 block font-mono text-xs font-medium text-stone-500">
                        {item.previousQuantity} → {item.currentQuantity}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {item.breakdown ? (
                        <div className="flex flex-col gap-1.5">
                          {item.breakdown.tradeable > 0 && (
                            <div className="inline-flex w-fit items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                              <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                              <span>
                                {t(
                                  'missingItemsDialog.breakdownTradeable',
                                  'Tradeable ({{count}})',
                                  { count: item.breakdown.tradeable }
                                )}
                              </span>
                            </div>
                          )}
                          {item.breakdown.onMarket > 0 && (
                            <div className="inline-flex w-fit items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                              <span className="size-1.5 rounded-full bg-amber-600 dark:bg-amber-400" />
                              <span>
                                {t(
                                  'missingItemsDialog.breakdownOnMarket',
                                  'On Market ({{count}})',
                                  { count: item.breakdown.onMarket }
                                )}
                              </span>
                            </div>
                          )}
                          {item.breakdown.tradeProtected > 0 && (
                            <div className="inline-flex w-fit items-center gap-1.5 rounded border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-400">
                              <span className="size-1.5 rounded-full bg-cyan-600 dark:bg-cyan-400" />
                              <span>
                                {t(
                                  'missingItemsDialog.breakdownProtected',
                                  'Trade Protected ({{count}})',
                                  { count: item.breakdown.tradeProtected }
                                )}
                              </span>
                            </div>
                          )}
                          {item.breakdown.hold > 0 && (
                            <div className="inline-flex w-fit items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
                              <span className="bg-red-650 size-1.5 animate-pulse rounded-full dark:bg-red-400" />
                              <span>
                                {t('missingItemsDialog.breakdownHold', 'Hold trade ({{count}})', {
                                  count: item.breakdown.hold,
                                })}
                              </span>
                            </div>
                          )}
                          {item.breakdown.tradeable === 0 &&
                            item.breakdown.onMarket === 0 &&
                            item.breakdown.tradeProtected === 0 &&
                            item.breakdown.hold === 0 && (
                              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-700 select-none dark:border-emerald-950/50 dark:bg-emerald-500/10 dark:text-emerald-400">
                                <CheckCircle className="size-4" />
                                <span>
                                  {t('missingItemsDialog.autoAdded', 'Auto-added to Portfolio')}
                                </span>
                              </div>
                            )}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-700 select-none dark:border-emerald-950/50 dark:bg-emerald-500/10 dark:text-emerald-400">
                          <CheckCircle className="size-4" />
                          <span>
                            {t('missingItemsDialog.autoAdded', 'Auto-added to Portfolio')}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Area */}
        <div className="border-stone-850 mt-5 flex shrink-0 items-center justify-end gap-3 border-t pt-5">
          <Button variant="outline" onClick={onClose} className="h-10 px-5 text-sm font-semibold">
            {t('common.ignore', 'Ignore')}
          </Button>
          <Button
            variant="primary"
            disabled={submitting}
            onClick={handleSubmit}
            className="h-10 px-6 text-sm font-bold shadow-md disabled:opacity-45"
          >
            {submitting ? t('common.processing', 'Processing...') : t('common.confirm', 'Confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
