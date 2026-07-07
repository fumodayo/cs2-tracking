'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  STEAM_ACCOUNTS_QUERY_KEY,
  STORAGE_UNITS_QUERY_KEY,
  fetchSteamAccounts,
  fetchAccountStorageUnits,
} from '@/lib/api-client/steam-accounts-api';
import { motion, AnimatePresence } from 'framer-motion';
import { TbUser, TbPackage, TbTag, TbCalendar, TbShield, TbCircleCheck } from 'react-icons/tb';
import { ChevronDown, ChevronUp, Trash2, Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Select } from '@/components/ui/select';
import { useCurrency } from '@/components/currency-provider';
import { formatDateVi, calculateTradeHoldUntil, getRemainingHoldDays } from '@/utils/date';
import { PortfolioTableRow } from '../portfolio-table-model';
import { TradeHoldBadge } from './trade-hold-badge';
import { AccessoryPreviewStrip } from './accessory-preview-strip';

interface ItemLotsListProps {
  relatedRows: PortfolioTableRow[];
  onUpdateQuantity?: (id: string, quantity: number) => Promise<void> | void;
  onUpdateBuyPrice?: (id: string, buyPrice: number) => Promise<void> | void;
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
      stickerPriceRate?: number;
      stickerBuyPriceRate?: number;
      stickerScanTotalPrice?: number;
      stickerScanPriceCapturedAt?: string;
    }
  ) => Promise<void> | void;
  onDelete?: (id: string) => void;
  embedded?: boolean;
  onSelectOpenChange?: (open: boolean) => void;
  onEditLot?: (lot: PortfolioTableRow) => void;
}

export function ItemLotsList({
  relatedRows,
  onUpdateQuantity,
  onUpdateBuyPrice,
  onUpdateNote,
  onUpdateLot,
  onDelete,
  embedded = false,
  onSelectOpenChange,
  onEditLot,
}: ItemLotsListProps) {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const [showDetails, setShowDetails] = useState(embedded);
  const [editingLotId, setEditingLotId] = useState<string | null>(null);

  // Active lot editing form states
  const [editQty, setEditQty] = useState('');
  const [editPriceVnd, setEditPriceVnd] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editAccountId, setEditAccountId] = useState('');
  const [editStorageUnitId, setEditStorageUnitId] = useState('');
  const [editState, setEditState] = useState<'tradeable' | 'hold' | 'protected'>('tradeable');
  const [editHoldDays, setEditHoldDays] = useState('');
  const [savingLot, setSavingLot] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PortfolioTableRow | null>(null);

  const accountsQuery = useQuery({
    queryKey: STEAM_ACCOUNTS_QUERY_KEY,
    queryFn: () => fetchSteamAccounts(),
    staleTime: 5 * 60 * 1000,
  });

  const storageUnitsQuery = useQuery({
    queryKey: STORAGE_UNITS_QUERY_KEY(editAccountId),
    queryFn: () => fetchAccountStorageUnits(editAccountId),
    enabled: !!editAccountId,
    staleTime: 5 * 60 * 1000,
  });

  const startEditingLot = (lot: PortfolioTableRow) => {
    if (onEditLot) {
      onEditLot(lot);
      return;
    }
    setEditingLotId(lot.id);
    setEditQty(String(lot.quantity));
    setEditPriceVnd(String(lot.buyPrice));
    setEditNote(lot.note ?? '');

    const steamId = lot.sourceAccounts?.[0]?.steamId64 ?? '';
    setEditAccountId(steamId);
    setEditStorageUnitId(lot.storageUnitId ?? '');

    const lotHoldDays = getRemainingHoldDays(lot.tradeHoldUntil);

    const isProtected = Boolean(
      lot.sourceAccounts?.[0]?.breakdown?.tradeProtected &&
      lot.sourceAccounts[0].breakdown.tradeProtected > 0
    );

    if (isProtected) {
      setEditState('protected');
      setEditHoldDays(lotHoldDays > 0 ? String(lotHoldDays) : '');
    } else if (lotHoldDays > 0) {
      setEditState('hold');
      setEditHoldDays(String(lotHoldDays));
    } else {
      setEditState('tradeable');
      setEditHoldDays('');
    }
  };

  const saveLot = async (lotId: string) => {
    const nextQuantity = Math.round(Number(editQty));
    const nextBuyPrice = Math.round(Number(editPriceVnd));
    if (
      !Number.isFinite(nextQuantity) ||
      nextQuantity <= 0 ||
      !Number.isFinite(nextBuyPrice) ||
      nextBuyPrice <= 0
    )
      return;

    setSavingLot(true);
    try {
      if (onUpdateLot) {
        let sourceAccounts = undefined;
        if (editAccountId) {
          const selectedAccount = accountsQuery.data?.find(
            (acc) => acc.steamId64 === editAccountId
          );
          if (selectedAccount) {
            const breakdown = {
              tradeable: editState === 'tradeable' ? nextQuantity : 0,
              onMarket: 0,
              tradeProtected: editState === 'protected' ? nextQuantity : 0,
              hold: editState === 'hold' ? nextQuantity : 0,
              holdDetails:
                editState === 'hold' || editState === 'protected'
                  ? [
                      {
                        quantity: nextQuantity,
                        holdDays: Number(editHoldDays) || 0,
                      },
                    ]
                  : [],
            };
            sourceAccounts = [
              {
                steamId64: editAccountId,
                name: selectedAccount.name,
                breakdown,
              },
            ];
          }
        } else {
          sourceAccounts = [];
        }

        let tradeHoldUntil = null;
        if ((editState === 'hold' || editState === 'protected') && editHoldDays) {
          const days = Number(editHoldDays) || 0;
          if (days > 0) {
            const targetLot = relatedRows.find((r) => r.id === lotId);
            const baseDate =
              targetLot && targetLot.buyDate ? new Date(targetLot.buyDate) : new Date();
            const holdDate = calculateTradeHoldUntil(baseDate, days);
            tradeHoldUntil = holdDate.toISOString();
          }
        }

        await onUpdateLot(lotId, {
          quantity: nextQuantity,
          buyPrice: nextBuyPrice,
          note: editNote,
          sourceAccounts,
          storageUnitId: editStorageUnitId || '',
          tradeHoldUntil,
        });
      } else {
        if (onUpdateQuantity) await onUpdateQuantity(lotId, nextQuantity);
        if (onUpdateBuyPrice) await onUpdateBuyPrice(lotId, nextBuyPrice);
        if (onUpdateNote) await onUpdateNote(lotId, editNote);
      }
      setEditingLotId(null);
    } finally {
      setSavingLot(false);
    }
  };

  return (
    <div className="space-y-3 pr-1">
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="group flex w-full cursor-pointer items-center justify-between py-2 text-left text-[10px] font-bold tracking-wider text-stone-400 uppercase transition-colors hover:text-stone-200 focus:outline-none"
      >
        <span className="flex items-center gap-1.5">
          <TbTag className="size-3.5 text-stone-400" />
          {t('portfolio.scanPurchaseDetails', 'Scan / purchase details ({{count}} lots)', {
            count: relatedRows.length,
          })}
        </span>
        <span className="text-stone-400 transition-transform duration-200 group-hover:text-stone-200">
          {showDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.25, 0, 1] }}
            className="overflow-hidden"
          >
            <div
              className={`mt-2 space-y-3 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-800/80 hover:[&::-webkit-scrollbar-thumb]:bg-stone-700/80 [&::-webkit-scrollbar-track]:bg-transparent ${
                embedded ? 'max-h-[32rem] overflow-y-auto' : 'max-h-[18rem] overflow-y-auto'
              }`}
            >
              {relatedRows.map((lot, lotIndex) => {
                const isEditing = editingLotId === lot.id;
                const formattedDate = lot.buyDate
                  ? formatDateVi(lot.buyDate)
                  : t('common.unknownDate', 'Unknown date');
                const accountName = lot.sourceAccounts?.[0]?.name;
                const stickers = lot.patternInfo?.stickers ?? [];
                const charms = lot.patternInfo?.charms ?? [];
                const hasAccessories = stickers.length + charms.length > 0;
                const shouldShowAccessoryLine = lot.itemType === 'skin' || hasAccessories;
                const patternBadges = [
                  lot.patternInfo?.floatValue !== undefined
                    ? `${t('inventoryScanner.floatValue', 'Float')}: ${lot.patternInfo.floatValue.toFixed(8)}`
                    : null,
                  lot.patternInfo?.paintSeed !== undefined
                    ? `${t('inventoryScanner.paintSeed', 'Paint Seed')}: ${lot.patternInfo.paintSeed}`
                    : null,
                ].filter((value): value is string => Boolean(value));

                const isProtected = Boolean(
                  lot.sourceAccounts?.[0]?.breakdown?.tradeProtected &&
                  lot.sourceAccounts[0].breakdown.tradeProtected > 0
                );
                const suDetail = lot.storageUnitDetails?.find(
                  (d) => d.storageUnitId === lot.storageUnitId
                );
                const suName =
                  suDetail?.storageUnitName ||
                  storageUnitsQuery.data?.find((su) => su.id === lot.storageUnitId)?.name;

                return (
                  <div
                    key={lot.id}
                    className={`group relative space-y-2.5 rounded-xl border transition duration-200 ${
                      isEditing
                        ? 'border-stone-700 bg-stone-900/20 p-4 shadow-lg shadow-black/35'
                        : 'border-stone-800/40 bg-stone-950/20 p-3 hover:border-stone-800 hover:bg-stone-900/10'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-4">
                        {lot.sourceType === 'existing' && (
                          <div className="flex items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-950/30 px-3 py-2 text-[10px] font-bold text-cyan-400 select-none">
                            <span className="flex items-center gap-1.5">
                              <TbShield className="size-3.5" />
                              {t('portfolio.scannedFromInventory', 'SCANNED FROM INVENTORY')}
                            </span>
                            <span className="text-[9px] font-medium text-cyan-400/80">
                              {t(
                                'portfolio.onlyEditPriceAndNote',
                                'Only unit price and note can be edited'
                              )}
                            </span>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-extrabold tracking-wider text-stone-500 uppercase">
                              {t('common.quantity', 'Quantity')}
                            </label>
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                value={editQty}
                                onChange={(e) => setEditQty(e.target.value)}
                                disabled={lot.sourceType === 'existing'}
                                className="hover:border-stone-750 focus:border-accent/40 focus:ring-accent/10 h-10 w-full [appearance:textfield] rounded-lg border border-stone-800 bg-stone-950/30 pr-3 pl-12 text-right text-sm font-semibold text-stone-100 placeholder-stone-600 transition-all duration-200 hover:bg-stone-950/60 focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:border-stone-900 disabled:bg-stone-950/20 disabled:text-stone-500 disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                              <span className="pointer-events-none absolute left-2.5 rounded border border-stone-800/50 bg-stone-900/60 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wider text-stone-400 select-none">
                                QTY
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-extrabold tracking-wider text-stone-500 uppercase">
                              {t('portfolio.buyPriceVnd', 'Buy price VND')}
                            </label>
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                value={editPriceVnd}
                                onChange={(e) => setEditPriceVnd(e.target.value)}
                                className="hover:border-stone-750 focus:border-accent/40 focus:ring-accent/10 h-10 w-full [appearance:textfield] rounded-lg border border-stone-800 bg-stone-950/30 pr-3 pl-12 text-right text-sm font-semibold text-stone-100 placeholder-stone-600 transition-all duration-200 hover:bg-stone-950/60 focus:ring-2 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                              <span className="pointer-events-none absolute left-2.5 rounded border border-stone-800/50 bg-stone-900/60 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wider text-stone-400 select-none">
                                VND
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-extrabold tracking-wider text-stone-500 uppercase">
                              {t('portfolio.owningAccounts', 'Owning Accounts')}
                            </label>
                            <Select
                              value={editAccountId || '__manual__'}
                              onValueChange={(val) => {
                                setEditAccountId(val === '__manual__' ? '' : val);
                                setEditStorageUnitId('');
                              }}
                              disabled={lot.sourceType === 'existing'}
                              onOpenChange={onSelectOpenChange}
                            >
                              <Select.Trigger className="hover:border-stone-750 focus:border-accent/40 focus:ring-accent/10 h-10 rounded-lg border border-stone-800 bg-stone-950/30 text-sm text-stone-200 transition hover:bg-stone-950/60 focus:ring-2 focus:outline-none disabled:border-stone-900 disabled:bg-stone-950/20 disabled:text-stone-500 disabled:opacity-50">
                                <Select.Value
                                  placeholder={t('portfolio.manualNoLink', 'Manual (Unlinked)')}
                                />
                              </Select.Trigger>
                              <Select.Content className="border-stone-850 bg-stone-950">
                                <Select.Item value="__manual__">
                                  {t('portfolio.manualNoLink', 'Manual (Unlinked)')}
                                </Select.Item>
                                {accountsQuery.data?.map((acc) => (
                                  <Select.Item key={acc.steamId64} value={acc.steamId64}>
                                    {acc.name}
                                  </Select.Item>
                                ))}
                              </Select.Content>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-extrabold tracking-wider text-stone-500 uppercase">
                              {t('portfolio.storedIn', 'Stored in')}
                            </label>
                            <Select
                              value={editStorageUnitId || '__inventory__'}
                              onValueChange={(val) =>
                                setEditStorageUnitId(val === '__inventory__' ? '' : val)
                              }
                              disabled={lot.sourceType === 'existing' || !editAccountId}
                              onOpenChange={onSelectOpenChange}
                            >
                              <Select.Trigger className="hover:border-stone-750 focus:border-accent/40 focus:ring-accent/10 h-10 rounded-lg border border-stone-800 bg-stone-950/30 text-sm text-stone-200 transition hover:bg-stone-950/60 focus:ring-2 focus:outline-none disabled:border-stone-900 disabled:bg-stone-950/20 disabled:text-stone-500 disabled:opacity-50">
                                <Select.Value
                                  placeholder={
                                    !editAccountId
                                      ? t(
                                          'portfolio.selectAccountFirst',
                                          'Select owning account first'
                                        )
                                      : t(
                                          'portfolio.personalInventory',
                                          'Personal inventory (Inventory)'
                                        )
                                  }
                                />
                              </Select.Trigger>
                              <Select.Content className="border-stone-850 bg-stone-950">
                                <Select.Item value="__inventory__">
                                  {t(
                                    'portfolio.personalInventory',
                                    'Personal inventory (Inventory)'
                                  )}
                                </Select.Item>
                                {storageUnitsQuery.data?.map((su) => (
                                  <Select.Item key={su.id} value={su.id}>
                                    {su.name} ({su.currentCount} items)
                                  </Select.Item>
                                ))}
                              </Select.Content>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div
                            className={
                              editState === 'hold' || editState === 'protected'
                                ? 'flex flex-col gap-1.5'
                                : 'col-span-2 flex flex-col gap-1.5'
                            }
                          >
                            <label className="text-[10px] font-extrabold tracking-wider text-stone-500 uppercase">
                              {t('portfolio.filterStatus', 'Status')}
                            </label>
                            <Select
                              value={editState}
                              onValueChange={(val) =>
                                setEditState(val as 'tradeable' | 'hold' | 'protected')
                              }
                              disabled={lot.sourceType === 'existing'}
                              onOpenChange={onSelectOpenChange}
                            >
                              <Select.Trigger className="hover:border-stone-750 focus:border-accent/40 focus:ring-accent/10 h-10 rounded-lg border border-stone-800 bg-stone-950/30 text-sm text-stone-200 transition hover:bg-stone-950/60 focus:ring-2 focus:outline-none disabled:border-stone-900 disabled:bg-stone-950/20 disabled:text-stone-500 disabled:opacity-50">
                                <Select.Value />
                              </Select.Trigger>
                              <Select.Content className="border-stone-850 bg-stone-950">
                                <Select.Item value="tradeable">
                                  {t('portfolio.statusTradeable', 'Tradeable')}
                                </Select.Item>
                                <Select.Item value="hold">
                                  {t('portfolio.statusHold', 'Hold')}
                                </Select.Item>
                                <Select.Item value="protected">
                                  {t('portfolio.statusTradeProtected', 'Trade Protected')}
                                </Select.Item>
                              </Select.Content>
                            </Select>
                          </div>

                          {(editState === 'hold' || editState === 'protected') && (
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-extrabold tracking-wider text-stone-500 uppercase">
                                {t('portfolio.holdDaysLabel', 'Hold days')}
                              </label>
                              <div className="relative flex items-center">
                                <input
                                  type="number"
                                  value={editHoldDays}
                                  onChange={(e) => setEditHoldDays(e.target.value)}
                                  placeholder={t('portfolio.exampleHoldDays', 'e.g., 7')}
                                  disabled={lot.sourceType === 'existing'}
                                  className="hover:border-stone-750 focus:border-accent/40 focus:ring-accent/10 h-10 w-full rounded-lg border border-stone-800 bg-stone-950/30 pr-3 pl-14 text-sm font-semibold text-stone-100 placeholder-stone-600 transition-all duration-200 hover:bg-stone-950/60 focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:border-stone-900 disabled:bg-stone-950/20 disabled:text-stone-500 disabled:opacity-50"
                                />
                                <span className="pointer-events-none absolute left-2.5 rounded border border-stone-800/50 bg-stone-900/60 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wider text-stone-400 select-none">
                                  HOLD
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-extrabold tracking-wider text-stone-500 uppercase">
                            {t('portfolio.note', 'Note')}
                          </label>
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              className="hover:border-stone-750 focus:border-accent/40 focus:ring-accent/10 h-10 w-full rounded-lg border border-stone-800 bg-stone-950/30 pr-3 pl-14 text-sm font-medium text-stone-100 transition-all duration-200 placeholder:text-stone-600 hover:bg-stone-950/60 focus:ring-2 focus:outline-none"
                            />
                            <span className="pointer-events-none absolute left-2.5 rounded border border-stone-800/50 bg-stone-900/60 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wider text-stone-400 select-none">
                              NOTE
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2.5 pt-2">
                          <Button
                            type="button"
                            onClick={() => setEditingLotId(null)}
                            className="hover:border-stone-750 h-10 cursor-pointer rounded-lg border border-stone-800 bg-stone-900/10 px-4 text-sm font-extrabold text-stone-300 shadow-sm transition hover:bg-stone-900/35 hover:text-stone-100 active:scale-[0.98]"
                          >
                            {t('common.cancel', 'Cancel')}
                          </Button>
                          <Button
                            type="button"
                            disabled={savingLot}
                            onClick={() => saveLot(lot.id)}
                            className="bg-accent hover:bg-accent-hover disabled:text-stone-650 disabled:border-stone-850/50 h-10 cursor-pointer rounded-lg px-5 text-sm font-extrabold text-white shadow-[0_4px_12px_rgba(59,130,246,0.18)] hover:shadow-[0_4px_16px_rgba(59,130,246,0.32)] active:scale-[0.98] disabled:cursor-not-allowed disabled:border disabled:bg-stone-900/50 disabled:shadow-none"
                          >
                            {savingLot ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md border border-stone-800/70 bg-stone-950/70 px-1 text-[10px] font-extrabold text-stone-300"
                              title={t('portfolio.itemInstanceNumber', 'Item #{{number}}', {
                                number: lotIndex + 1,
                              })}
                            >
                              #{lotIndex + 1}
                            </span>
                            <span className="text-sm font-extrabold text-stone-100">
                              {lot.quantity}
                            </span>
                            <span className="mr-1.5 text-[10px] font-semibold text-stone-400">
                              {t('portfolio.itemsUnit', 'items')}
                            </span>
                            <span className="text-[10px] font-semibold text-stone-500">@</span>
                            <span className="text-sm font-extrabold text-emerald-400">
                              {formatCurrency(lot.buyPrice)}
                            </span>
                            <span className="mx-1 text-stone-700">•</span>
                            {isProtected ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold text-cyan-400">
                                <TbShield className="size-2.5" />
                                Protected
                              </span>
                            ) : lot.tradeHoldUntil ? (
                              <TradeHoldBadge tradeHoldUntil={lot.tradeHoldUntil} size="sm" />
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                                <TbCircleCheck className="size-2.5" />
                                {t('portfolio.statusTradeable', 'Tradeable')}
                              </span>
                            )}
                          </div>
                          {shouldShowAccessoryLine ? (
                            <div className="mt-2">
                              <AccessoryPreviewStrip
                                stickers={stickers}
                                charms={charms}
                                maxVisible={5}
                                showNames
                                emptyLabel={t('portfolio.noStickerCharm', 'No sticker/charm')}
                              />
                            </div>
                          ) : null}
                          {patternBadges.length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {patternBadges.map((label) => (
                                <span
                                  key={label}
                                  className="inline-flex rounded border border-violet-500/15 bg-violet-500/5 px-1.5 py-0.5 text-[9px] font-semibold text-violet-300"
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-stone-500">
                            <span className="inline-flex items-center gap-1 rounded border border-stone-800/30 bg-stone-900/40 px-1.5 py-0.5 text-[9px] font-semibold text-stone-400">
                              <TbCalendar className="size-3 text-stone-500" /> {formattedDate}
                            </span>
                            {accountName && (
                              <span className="inline-flex max-w-[8rem] items-center gap-1 truncate rounded border border-sky-500/10 bg-sky-500/5 px-1.5 py-0.5 text-[9px] font-semibold text-sky-400">
                                <TbUser className="size-2.5 text-sky-400" /> {accountName}
                              </span>
                            )}
                            {suName && (
                              <span className="inline-flex max-w-[8rem] items-center gap-1 truncate rounded border border-amber-500/10 bg-amber-500/5 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
                                <TbPackage className="size-2.5 text-amber-400" /> {suName}
                              </span>
                            )}
                            {lot.note && !lot.note.toLowerCase().includes('scanner') && (
                              <span
                                className="inline-flex max-w-[8rem] items-center gap-1 truncate rounded border border-emerald-500/10 bg-emerald-500/5 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400"
                                title={lot.note}
                              >
                                <TbTag className="size-2.5 text-emerald-400" /> {lot.note}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ml-2 flex shrink-0 items-center gap-1.5">
                          <Button
                            type="button"
                            onClick={() => startEditingLot(lot)}
                            className="hover:border-stone-750 flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-stone-800/80 bg-stone-950/40 p-0 text-stone-400 transition-all hover:bg-stone-900/50 hover:text-stone-200"
                            title={t('portfolio.editLotTitle', 'Edit this lot')}
                          >
                            <Pencil className="size-3" />
                          </Button>
                          {onDelete && (
                            <Button
                              type="button"
                              onClick={() => setDeleteTarget(lot)}
                              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-stone-800/80 bg-stone-950/40 p-0 text-stone-400 transition-all hover:border-rose-900/40 hover:bg-rose-950/30 hover:text-rose-400"
                              title={t('portfolio.deleteLotTitle', 'Delete this lot')}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t('portfolio.deleteLotTitle', 'Delete this lot')}
        description={t(
          'portfolio.confirmDeleteLot',
          'Are you sure you want to delete this purchase lot ({{quantity}} items @ {{buyPrice}})?',
          {
            quantity: deleteTarget?.quantity ?? 0,
            buyPrice: deleteTarget ? formatCurrency(deleteTarget.buyPrice) : '',
          }
        )}
        confirmText={t('portfolio.confirmDeleteButton', 'Yes, delete')}
        cancelText={t('common.cancel', 'Cancel')}
        variant="danger"
        onConfirm={async () => {
          if (deleteTarget && onDelete) {
            await onDelete(deleteTarget.id);
          }
        }}
      />
    </div>
  );
}
