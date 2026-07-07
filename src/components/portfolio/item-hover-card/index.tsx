'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { usePatternInspect } from '@/components/inventory-scanner/hooks/use-pattern-inspect';
import {
  STEAM_ACCOUNTS_QUERY_KEY,
  STORAGE_UNITS_QUERY_KEY,
  fetchSteamAccounts,
  fetchAccountStorageUnits,
} from '@/lib/api-client/steam-accounts-api';
import { SlidePanel, SlidePanelContent } from '@/components/ui/slide-panel';

import { formatIntegerViInput, formatDecimalViInput, parseViFloat } from '@/utils/format';

import { PortfolioTableRow } from '../portfolio-table-model';
import { getItemTypeColor, toInputNumber } from '../portfolio-table-utils';

import { VirtualItemCard } from '../components/virtual-item-card';
import { AccountAllocationBreakdown } from '@/components/steam-accounts';
import { ItemLotsList } from '../components/item-lots-list';

import { ItemActions } from './item-actions';
import { ItemHoverCardHeader } from './item-hover-card-header';
import { PatternInspectSection } from './pattern-inspect-section';
import { SingleLotEditSection } from './single-lot-edit-section';
import { StorageUnitAllocationSection } from './storage-unit-allocation-section';
import {
  buildLotSourceAccounts,
  getDefaultItemTradeState,
  getItemHoverCardTargetId,
  getTradeHoldUntilForState,
  type ItemTradeState,
} from './lot-update-helpers';

type ItemPatternInfo = NonNullable<PortfolioTableRow['patternInfo']>;

export function ItemHoverCard({
  item,
  relatedRows,
  onUpdateQuantity,
  onUpdateBuyPrice,
  onUpdateNote,
  onUpdateLot,
  fetchBuffPrice,
  buffLoadingKeys,
  buffCnyToVndRate,
  buffPricesCny,
  onUpdateBuffPrice,
  onDelete,
  deletingId,
  embedded = false,
  readOnly = false,
  onSelectOpenChange,
  useSellLabel = false,
  onClose,
  onSellItem,
  onSellAll,
  onDeleteAll,
  isGuest = false,
}: {
  item: PortfolioTableRow;
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
      dopplerPhase?: string;
      patternInfo?: PortfolioTableRow['patternInfo'];
      stickerPriceRate?: number;
      stickerBuyPriceRate?: number;
      stickerScanTotalPrice?: number;
      stickerScanPriceCapturedAt?: string;
    }
  ) => Promise<void> | void;
  onUpdateBuffRate?: (rate: number) => void;
  fetchBuffPrice?: (marketHashName: string) => void;
  buffLoadingKeys?: Set<string>;
  buffCnyToVndRate?: number;
  buffPricesCny?: Record<string, number>;
  onUpdateBuffPrice?: (marketHashName: string, priceCny: number | null) => void;
  onDelete?: (id: string) => void;
  deletingId?: string | null;
  embedded?: boolean;
  readOnly?: boolean;
  onSelectOpenChange?: (open: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onOpenDetails?: () => void;
  useSellLabel?: boolean;
  defaultEditing?: boolean;
  onClose?: () => void;
  onSellItem?: (id: string) => void;
  onSellAll?: () => void;
  onDeleteAll?: () => void;
  isGuest?: boolean;
}) {
  const { t } = useTranslation();
  const [selectedEditingLot, setSelectedEditingLot] = useState<PortfolioTableRow | null>(null);

  const hasBuff = useMemo(() => {
    const hasBuffPrice = Boolean(buffPricesCny?.[item.case.marketHashName]);
    const isSkin = item.itemType === 'skin';
    const steamVal = item.steamPrice ?? item.currentPrice ?? 0;
    const currentVal = item.currentPrice ?? 0;
    const currentDiffersFromSteam =
      isSkin && currentVal > 0 && steamVal > 0 && currentVal !== steamVal;
    return hasBuffPrice || currentDiffersFromSteam;
  }, [item, buffPricesCny]);

  const [quantity, setQuantity] = useState(() => formatIntegerViInput(item.quantity));
  const [priceCny, setPriceCny] = useState(() => {
    if (hasBuff) {
      const defaultVnd = item.buyPrice || item.steamPrice || item.currentPrice || 0;
      return formatDecimalViInput(defaultVnd / (buffCnyToVndRate ?? 3600));
    } else {
      const defaultVnd = item.steamPrice || item.currentPrice || 0;
      return formatIntegerViInput(defaultVnd);
    }
  });
  const [buyRate, setBuyRate] = useState(() => {
    if (hasBuff) {
      return formatIntegerViInput(buffCnyToVndRate ?? 3600);
    } else {
      if (item.buyPrice > 0) {
        const defaultMarket = item.steamPrice || item.currentPrice || 0;
        if (defaultMarket > 0) {
          return String(Math.round((item.buyPrice / defaultMarket) * 100));
        }
      }
      return '100';
    }
  });
  const [priceVnd, setPriceVnd] = useState(() => {
    const defaultVnd = item.buyPrice || item.steamPrice || item.currentPrice || 0;
    return formatIntegerViInput(defaultVnd);
  });
  const [note, setNote] = useState(() => item.note ?? '');
  const [saving, setSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [sellRate, setSellRate] = useState(() => formatIntegerViInput(buffCnyToVndRate ?? 3600));

  const [stickerRate, setStickerRate] = useState(() => String(item.stickerPriceRate ?? 0));
  const [stickerBuyRate, setStickerBuyRate] = useState(() => String(item.stickerBuyPriceRate ?? 0));
  const [stickerFormulaTotal, setStickerFormulaTotal] = useState<number | null>(null);
  const [capturedScanTotal, setCapturedScanTotal] = useState<number | null>(
    () => item.stickerScanTotalPrice ?? null
  );
  const [capturedScanDate, setCapturedScanDate] = useState<string | undefined>(
    () => item.stickerScanPriceCapturedAt
  );

  const { inspectingKeys, inspectPattern } = usePatternInspect();
  const [inspectError, setInspectError] = useState<string | null>(null);
  const isInspecting = inspectingKeys.has(item.case.marketHashName);
  async function applyPatternInspectResult(patternInfo: ItemPatternInfo, inspectLink?: string) {
    const updatePayload = {
      dopplerPhase: patternInfo.dopplerPhase || item.dopplerPhase,
      patternInfo,
      ...(inspectLink ? { inspectLink } : {}),
    };

    if (item.itemIds && item.itemIds.length > 0) {
      for (const id of item.itemIds) {
        await onUpdateLot?.(id, updatePayload);
      }
    } else {
      await onUpdateLot?.(item.id, updatePayload);
    }
  }

  const handleInspect = async () => {
    if (!item.inspectLink) return;
    setInspectError(null);
    const res = await inspectPattern(item.inspectLink, item.case.marketHashName, item.dopplerPhase);
    if (res.success && res.data?.patternInfo) {
      await applyPatternInspectResult(res.data.patternInfo);
    } else {
      setInspectError(res.error || 'failedToInspectFromCSFloat');
    }
  };

  const [manualInspectLink, setManualInspectLink] = useState('');

  const handleManualInspect = async () => {
    if (!manualInspectLink.trim()) return;
    setInspectError(null);
    const res = await inspectPattern(
      manualInspectLink.trim(),
      item.case.marketHashName,
      item.dopplerPhase
    );
    if (res.success && res.data?.patternInfo) {
      await applyPatternInspectResult(res.data.patternInfo, manualInspectLink.trim());
    } else {
      setInspectError(res.error || 'failedToInspectFromCSFloat');
    }
  };

  const [isFindingLink, setIsFindingLink] = useState(false);
  const [findStatus, setFindStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleAutoFind = async () => {
    setIsFindingLink(true);
    setFindStatus('idle');
    setInspectError(null);
    try {
      const res = await fetch(
        `/api/portfolio/find-inspect-link?marketHashName=${encodeURIComponent(
          item.case.marketHashName
        )}`
      );
      if (!res.ok) throw new Error('failedToFind');
      const data = await res.json();
      if (data.inspectLink) {
        setFindStatus('success');
        setManualInspectLink(data.inspectLink);

        // Auto-run inspect pattern with the link found
        const scanRes = await inspectPattern(
          data.inspectLink,
          item.case.marketHashName,
          item.dopplerPhase
        );
        if (scanRes.success && scanRes.data?.patternInfo) {
          await applyPatternInspectResult(scanRes.data.patternInfo, data.inspectLink);
        } else {
          setInspectError(scanRes.error || 'failedToInspectFromCSFloat');
          setFindStatus('error');
        }
      } else {
        setFindStatus('error');
      }
    } catch {
      setFindStatus('error');
    } finally {
      setIsFindingLink(false);
    }
  };

  const [editAccountId, setEditAccountId] = useState(
    () => item.sourceAccounts?.[0]?.steamId64 ?? ''
  );
  const [editStorageUnitId, setEditStorageUnitId] = useState(() => item.storageUnitId ?? '');
  const [editState, setEditState] = useState<ItemTradeState>(
    () => getDefaultItemTradeState(item).state
  );
  const [editHoldDays, setEditHoldDays] = useState(() => getDefaultItemTradeState(item).holdDays);

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

  const accountOptions = useMemo(() => {
    const map = new Map<string, { id: string; steamId64: string; name: string }>();

    for (const account of accountsQuery.data ?? []) {
      map.set(account.steamId64, {
        id: account.id,
        steamId64: account.steamId64,
        name: account.name,
      });
    }

    for (const account of item.sourceAccounts ?? []) {
      if (!account.steamId64 || map.has(account.steamId64)) continue;
      map.set(account.steamId64, {
        id: account.steamId64,
        steamId64: account.steamId64,
        name: account.name || account.steamId64,
      });
    }

    return Array.from(map.values());
  }, [accountsQuery.data, item.sourceAccounts]);

  const isVirtual = item.sourceType === 'existing' && item.isVirtual;

  // Load draft from localStorage on mount/props changes, falling back to props values
  useEffect(() => {
    let loadedFromDraft = false;
    try {
      const saved = localStorage.getItem(`item_hover_card_draft_${item.id}`);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft) {
          const defaultVnd = item.buyPrice || item.steamPrice || item.currentPrice || 0;
          setQuantity(formatIntegerViInput(draft.quantity ?? String(item.quantity)));
          setPriceVnd(formatIntegerViInput(draft.priceVnd ?? toInputNumber(defaultVnd)));

          if (hasBuff) {
            setPriceCny(
              formatDecimalViInput(
                draft.priceCny ?? toInputNumber(defaultVnd / (buffCnyToVndRate ?? 3600))
              )
            );
            setBuyRate(
              formatIntegerViInput(draft.buyRate ?? toInputNumber(buffCnyToVndRate ?? 3600))
            );
          } else {
            const defaultMarket = item.steamPrice || item.currentPrice || 0;
            setPriceCny(formatIntegerViInput(draft.priceCny ?? toInputNumber(defaultMarket)));
            if (item.buyPrice > 0 && defaultMarket > 0) {
              setBuyRate(
                formatIntegerViInput(
                  draft.buyRate ?? String(Math.round((item.buyPrice / defaultMarket) * 100))
                )
              );
            } else {
              setBuyRate(formatIntegerViInput(draft.buyRate ?? '100'));
            }
          }
          setNote(draft.note ?? item.note ?? '');
          setEditAccountId(draft.editAccountId ?? item.sourceAccounts?.[0]?.steamId64 ?? '');
          setEditStorageUnitId(draft.editStorageUnitId ?? item.storageUnitId ?? '');
          setEditState(draft.editState ?? 'tradeable');
          setEditHoldDays(draft.editHoldDays ?? '');
          setStickerRate(draft.stickerRate ?? String(item.stickerPriceRate ?? 0));
          setStickerBuyRate(draft.stickerBuyRate ?? String(item.stickerBuyPriceRate ?? 0));
          setCapturedScanTotal(draft.capturedScanTotal ?? item.stickerScanTotalPrice ?? null);
          setCapturedScanDate(draft.capturedScanDate ?? item.stickerScanPriceCapturedAt);
          loadedFromDraft = true;
        }
      }
    } catch (e) {
      console.error('Failed to parse item draft from localStorage', e);
    }

    if (!loadedFromDraft) {
      const defaultVnd = item.buyPrice || item.steamPrice || item.currentPrice || 0;
      setQuantity(formatIntegerViInput(item.quantity));
      setPriceVnd(formatIntegerViInput(defaultVnd));
      if (hasBuff) {
        setPriceCny(formatDecimalViInput(defaultVnd / (buffCnyToVndRate ?? 3600)));
        setBuyRate(formatIntegerViInput(buffCnyToVndRate ?? 3600));
      } else {
        const defaultMarket = item.steamPrice || item.currentPrice || 0;
        setPriceCny(formatIntegerViInput(defaultMarket));
        if (item.buyPrice > 0 && defaultMarket > 0) {
          setBuyRate(String(Math.round((item.buyPrice / defaultMarket) * 100)));
        } else {
          setBuyRate('100');
        }
      }
      setNote(item.note ?? '');
      setSellRate(formatIntegerViInput(buffCnyToVndRate ?? 3600));

      const steamId = item.sourceAccounts?.[0]?.steamId64 ?? '';
      setEditAccountId(steamId);
      setEditStorageUnitId(item.storageUnitId ?? '');

      const defaultTradeState = getDefaultItemTradeState({
        sourceAccounts: item.sourceAccounts,
        tradeHoldUntil: item.tradeHoldUntil,
      });
      setEditState(defaultTradeState.state);
      setEditHoldDays(defaultTradeState.holdDays);

      setStickerRate(String(item.stickerPriceRate ?? 0));
      setStickerBuyRate(String(item.stickerBuyPriceRate ?? 0));
      setCapturedScanTotal(item.stickerScanTotalPrice ?? null);
      setCapturedScanDate(item.stickerScanPriceCapturedAt);
    }
  }, [
    item.id,
    item.quantity,
    item.buyPrice,
    item.currentPrice,
    item.steamPrice,
    item.note,
    buffCnyToVndRate,
    item.sourceAccounts,
    item.storageUnitId,
    item.tradeHoldUntil,
    item.stickerPriceRate,
    item.stickerBuyPriceRate,
    item.stickerScanTotalPrice,
    item.stickerScanPriceCapturedAt,
    hasBuff,
  ]);

  // Check if form values match default values from props
  const isDefault = useMemo(() => {
    const defaultTradeState = getDefaultItemTradeState(item);

    const defaultMarket = hasBuff
      ? (item.buyPrice || item.steamPrice || item.currentPrice || 0) / (buffCnyToVndRate ?? 3600)
      : item.steamPrice || item.currentPrice || 0;

    const defaultRate = hasBuff
      ? (buffCnyToVndRate ?? 3600)
      : item.buyPrice > 0 && (item.steamPrice || item.currentPrice || 0) > 0
        ? Math.round((item.buyPrice / (item.steamPrice || item.currentPrice || 1)) * 100)
        : 100;

    return (
      parseViFloat(quantity) === item.quantity &&
      parseViFloat(priceVnd) === (item.buyPrice || item.steamPrice || item.currentPrice || 0) &&
      parseViFloat(priceCny) === defaultMarket &&
      parseViFloat(buyRate) === defaultRate &&
      note === (item.note ?? '') &&
      editAccountId === (item.sourceAccounts?.[0]?.steamId64 ?? '') &&
      editStorageUnitId === (item.storageUnitId ?? '') &&
      editState === defaultTradeState.state &&
      (editState !== 'hold' || editHoldDays === defaultTradeState.holdDays) &&
      parseViFloat(stickerRate) === (item.stickerPriceRate ?? 0) &&
      parseViFloat(stickerBuyRate) === (item.stickerBuyPriceRate ?? 0) &&
      capturedScanTotal === (item.stickerScanTotalPrice ?? null) &&
      capturedScanDate === item.stickerScanPriceCapturedAt
    );
  }, [
    item,
    quantity,
    priceVnd,
    priceCny,
    buyRate,
    note,
    editAccountId,
    editStorageUnitId,
    editState,
    editHoldDays,
    buffCnyToVndRate,
    stickerRate,
    stickerBuyRate,
    capturedScanTotal,
    capturedScanDate,
    hasBuff,
  ]);

  // Auto-save draft on changes
  useEffect(() => {
    if (!item.id) return;
    try {
      if (isDefault) {
        localStorage.removeItem(`item_hover_card_draft_${item.id}`);
      } else {
        const draft = {
          quantity,
          priceCny,
          buyRate,
          priceVnd,
          note,
          editAccountId,
          editStorageUnitId,
          editState,
          editHoldDays,
          stickerRate,
          stickerBuyRate,
          capturedScanTotal,
          capturedScanDate,
        };
        localStorage.setItem(`item_hover_card_draft_${item.id}`, JSON.stringify(draft));
      }
    } catch (e) {
      console.error('Failed to save draft to localStorage', e);
    }
  }, [
    item.id,
    isDefault,
    quantity,
    priceCny,
    buyRate,
    priceVnd,
    note,
    editAccountId,
    editStorageUnitId,
    editState,
    editHoldDays,
    stickerRate,
    stickerBuyRate,
    capturedScanTotal,
    capturedScanDate,
  ]);

  function updateCny(value: string) {
    const formatted = hasBuff ? formatDecimalViInput(value) : formatIntegerViInput(value);
    setPriceCny(formatted);
    const val = parseViFloat(formatted);
    const rate = parseViFloat(buyRate);
    if (Number.isFinite(val) && Number.isFinite(rate)) {
      if (hasBuff) {
        setPriceVnd(formatIntegerViInput(Math.round(val * rate)));
      } else {
        setPriceVnd(formatIntegerViInput(Math.round(val * (rate / 100))));
      }
    }
  }

  function updateBuyRate(value: string) {
    const formatted = formatIntegerViInput(value);
    setBuyRate(formatted);
    const val = parseViFloat(priceCny);
    const rate = parseViFloat(formatted);
    if (Number.isFinite(val) && Number.isFinite(rate)) {
      if (hasBuff) {
        setPriceVnd(formatIntegerViInput(Math.round(val * rate)));
      } else {
        setPriceVnd(formatIntegerViInput(Math.round(val * (rate / 100))));
      }
    }
  }

  function updateSellRate(value: string) {
    setSellRate(formatIntegerViInput(value));
  }

  function updateVnd(value: string) {
    const formatted = formatIntegerViInput(value);
    setPriceVnd(formatted);
    const vnd = parseViFloat(formatted);
    if (Number.isFinite(vnd)) {
      if (hasBuff) {
        const rate = parseViFloat(buyRate);
        if (Number.isFinite(rate) && rate > 0) {
          setPriceCny(formatDecimalViInput(vnd / rate));
        }
      } else {
        const marketVal = parseViFloat(priceCny);
        if (Number.isFinite(marketVal) && marketVal > 0) {
          setBuyRate(formatIntegerViInput(Math.round((vnd / marketVal) * 100)));
        }
      }
    }
  }

  async function submit() {
    const nextQuantity = Math.round(parseViFloat(quantity));
    const nextBuyPrice = Math.round(parseViFloat(priceVnd));
    if (
      !Number.isFinite(nextQuantity) ||
      nextQuantity <= 0 ||
      !Number.isFinite(nextBuyPrice) ||
      nextBuyPrice <= 0
    )
      return;

    setSaving(true);
    try {
      const targetId = getItemHoverCardTargetId(item, relatedRows);
      if (onUpdateLot) {
        const sourceAccounts = buildLotSourceAccounts({
          editAccountId,
          accountOptions,
          editState,
          quantity: nextQuantity,
          editHoldDays,
        });
        const tradeHoldUntil = getTradeHoldUntilForState({
          editState,
          editHoldDays,
          buyDate: item.buyDate,
        });
        const stickerPriceRateVal = parseViFloat(stickerRate);
        const stickerBuyPriceRateVal = parseViFloat(stickerBuyRate);

        await onUpdateLot(targetId, {
          quantity: nextQuantity,
          buyPrice: nextBuyPrice,
          note: note,
          sourceAccounts,
          storageUnitId: editStorageUnitId || '',
          tradeHoldUntil,
          stickerPriceRate: Number.isFinite(stickerPriceRateVal) ? stickerPriceRateVal : undefined,
          stickerBuyPriceRate: Number.isFinite(stickerBuyPriceRateVal)
            ? stickerBuyPriceRateVal
            : undefined,
          stickerScanTotalPrice: capturedScanTotal !== null ? capturedScanTotal : undefined,
          stickerScanPriceCapturedAt: capturedScanDate,
        });
      } else {
        if (onUpdateQuantity && nextQuantity !== item.quantity) {
          await onUpdateQuantity(targetId, nextQuantity);
        }
        if (onUpdateBuyPrice && nextBuyPrice !== item.buyPrice) {
          await onUpdateBuyPrice(targetId, nextBuyPrice);
        }
        if (onUpdateNote && note !== (item.note ?? '')) {
          await onUpdateNote(targetId, note);
        }
      }
      try {
        localStorage.removeItem(`item_hover_card_draft_${item.id}`);
      } catch {
        /* ignore */
      }
      onClose?.();
    } finally {
      setSaving(false);
    }
  }

  const handleReset = () => {
    setIsResetting(true);
    try {
      localStorage.removeItem(`item_hover_card_draft_${item.id}`);
    } catch {
      /* ignore */
    }
    setQuantity(formatIntegerViInput(item.quantity));

    const defaultVnd = item.buyPrice || item.steamPrice || item.currentPrice || 0;
    setPriceVnd(formatIntegerViInput(defaultVnd));
    if (hasBuff) {
      setPriceCny(formatDecimalViInput(defaultVnd / (buffCnyToVndRate ?? 3600)));
      setBuyRate(formatIntegerViInput(buffCnyToVndRate ?? 3600));
    } else {
      const defaultMarket = item.steamPrice || item.currentPrice || 0;
      setPriceCny(formatIntegerViInput(defaultMarket));
      if (item.buyPrice > 0 && defaultMarket > 0) {
        setBuyRate(String(Math.round((item.buyPrice / defaultMarket) * 100)));
      } else {
        setBuyRate('100');
      }
    }
    setNote(item.note ?? '');
    setSellRate(formatIntegerViInput(buffCnyToVndRate ?? 3600));
    const steamId = item.sourceAccounts?.[0]?.steamId64 ?? '';
    setEditAccountId(steamId);
    setEditStorageUnitId(item.storageUnitId ?? '');
    setStickerRate(String(item.stickerPriceRate ?? 0));
    setStickerBuyRate(String(item.stickerBuyPriceRate ?? 0));
    setCapturedScanTotal(item.stickerScanTotalPrice ?? null);
    setCapturedScanDate(item.stickerScanPriceCapturedAt);
    setStickerFormulaTotal(null);
    const defaultTradeState = getDefaultItemTradeState(item);
    setEditState(defaultTradeState.state);
    setEditHoldDays(defaultTradeState.holdDays);
    setTimeout(() => {
      setIsResetting(false);
      onClose?.();
    }, 400);
  };
  const isLoadingBuff = Boolean(buffLoadingKeys?.has(item.case.marketHashName));

  const typeColor =
    item.itemType === 'capsule' || item.itemType === 'case'
      ? '#b0c3d9'
      : (item.case.rarity?.color ?? getItemTypeColor(item.itemType));

  const hasBuffPrice = Boolean(buffPricesCny?.[item.case.marketHashName]);
  const steamPriceVal = item.steamPrice ?? item.currentPrice ?? 0;
  const showBuffButton = Boolean(
    item.itemType === 'skin' && steamPriceVal > 5000 && (!hasBuffPrice || isLoadingBuff)
  );
  if (isVirtual) {
    return <VirtualItemCard item={item} typeColor={typeColor} accounts={accountOptions} />;
  }

  return (
    <div className={embedded ? 'flex min-h-full w-full flex-col text-left' : 'w-[25rem] text-left'}>
      <div
        className={`relative overflow-hidden text-stone-100 transition-all duration-300 ${
          embedded
            ? 'flex min-h-full flex-1 flex-col bg-stone-950'
            : 'rounded-2xl border border-stone-800/80 bg-stone-950 shadow-[0_20px_50px_rgba(0,0,0,0.65)] backdrop-blur-xl hover:border-stone-700/80'
        }`}
      >
        {!embedded && (
          <div
            className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 rounded-full opacity-[0.08] blur-3xl"
            style={{ backgroundColor: typeColor }}
          />
        )}

        <ItemHoverCardHeader item={item} typeColor={typeColor} embedded={embedded} />

        <div
          className={`p-4 ${embedded ? 'flex-1' : 'max-h-[440px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-800/80 hover:[&::-webkit-scrollbar-thumb]:bg-stone-700/80 [&::-webkit-scrollbar-track]:bg-transparent'}`}
        >
          <AccountAllocationBreakdown relatedRows={relatedRows} />

          <PatternInspectSection
            item={item}
            relatedRows={relatedRows}
            buffPricesCny={buffPricesCny}
            buffCnyToVndRate={buffCnyToVndRate}
            isInspecting={isInspecting}
            inspectError={inspectError}
            onInspect={handleInspect}
            manualInspectLink={manualInspectLink}
            onManualInspectLinkChange={setManualInspectLink}
            onManualInspect={handleManualInspect}
            onAutoFind={handleAutoFind}
            isFindingLink={isFindingLink}
            findStatus={findStatus}
            t={t}
          />

          <StorageUnitAllocationSection
            storageUnitDetails={item.storageUnitDetails}
            accounts={accountOptions}
            t={t}
          />
          {relatedRows.length <= 1 ? (
            <SingleLotEditSection
              item={item}
              isResetting={isResetting}
              editAccountId={editAccountId}
              setEditAccountId={setEditAccountId}
              editStorageUnitId={editStorageUnitId}
              setEditStorageUnitId={setEditStorageUnitId}
              editState={editState}
              setEditState={setEditState}
              editHoldDays={editHoldDays}
              setEditHoldDays={setEditHoldDays}
              accounts={accountOptions}
              storageUnits={storageUnitsQuery.data}
              onSelectOpenChange={onSelectOpenChange}
              priceVnd={priceVnd}
              setPriceVnd={setPriceVnd}
              quantity={quantity}
              setQuantity={setQuantity}
              priceCny={priceCny}
              updateCny={updateCny}
              buyRate={buyRate}
              updateBuyRate={updateBuyRate}
              sellRate={sellRate}
              updateSellRate={updateSellRate}
              note={note}
              setNote={setNote}
              updateVnd={updateVnd}
              submit={submit}
              stickerBuyRate={stickerBuyRate}
              setStickerBuyRate={setStickerBuyRate}
              stickerRate={stickerRate}
              setStickerRate={setStickerRate}
              capturedScanTotal={capturedScanTotal}
              capturedScanDate={capturedScanDate}
              setStickerFormulaTotal={setStickerFormulaTotal}
              stickerFormulaTotal={stickerFormulaTotal}
              hasBuff={hasBuff}
              useSellLabel={useSellLabel}
              isGuest={isGuest}
              readOnly={readOnly}
            />
          ) : (
            <ItemLotsList
              relatedRows={relatedRows}
              onUpdateQuantity={onUpdateQuantity}
              onUpdateBuyPrice={onUpdateBuyPrice}
              onUpdateNote={onUpdateNote}
              onUpdateLot={onUpdateLot}
              onDelete={onDelete}
              embedded={embedded}
              onSelectOpenChange={onSelectOpenChange}
              onEditLot={(lot) => setSelectedEditingLot(lot)}
            />
          )}
        </div>

        {(relatedRows.length <= 1 ||
          ((showBuffButton || hasBuffPrice) && relatedRows.length > 1) ||
          Boolean(onSellAll) ||
          Boolean(onDeleteAll)) && (
          <ItemActions
            item={item}
            relatedRows={relatedRows}
            showBuffButton={showBuffButton}
            hasBuffPrice={hasBuffPrice}
            isLoadingBuff={isLoadingBuff}
            deletingId={deletingId}
            saving={saving}
            isDefault={isDefault}
            embedded={embedded}
            fetchBuffPrice={fetchBuffPrice}
            onUpdateBuffPrice={onUpdateBuffPrice}
            onDelete={onDelete}
            onReset={handleReset}
            onSubmit={submit}
            onSellItem={onSellItem}
            onSellAll={onSellAll}
            onDeleteAll={onDeleteAll}
          />
        )}
      </div>

      <SlidePanel
        open={!!selectedEditingLot}
        onOpenChange={(open: boolean) => !open && setSelectedEditingLot(null)}
        modal={false}
      >
        {selectedEditingLot && (
          <SlidePanelContent
            title={selectedEditingLot.case.name}
            hideHeader
            noPadding
            side="left"
            showOverlay={false}
            className="border-stone-850/80 border-border max-w-[440px] overflow-hidden border-r bg-[#0e121a] text-stone-100 shadow-[0_30px_90px_rgba(0,0,0,0.9)] backdrop-blur-3xl"
          >
            <ItemHoverCard
              item={selectedEditingLot}
              relatedRows={[selectedEditingLot]}
              onUpdateQuantity={onUpdateQuantity}
              onUpdateBuyPrice={onUpdateBuyPrice}
              onUpdateNote={onUpdateNote}
              onUpdateLot={onUpdateLot}
              fetchBuffPrice={fetchBuffPrice}
              buffLoadingKeys={buffLoadingKeys}
              buffCnyToVndRate={buffCnyToVndRate}
              buffPricesCny={buffPricesCny}
              onUpdateBuffPrice={onUpdateBuffPrice}
              onDelete={onDelete}
              deletingId={deletingId}
              embedded
              defaultEditing
              onClose={() => setSelectedEditingLot(null)}
              onSellItem={(id) => {
                onSellItem?.(id);
                setSelectedEditingLot(null);
              }}
            />
          </SlidePanelContent>
        )}
      </SlidePanel>
    </div>
  );
}
