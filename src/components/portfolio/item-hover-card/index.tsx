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
import { TbPackage } from 'react-icons/tb';
import { SlidePanel, SlidePanelContent } from '@/components/ui/slide-panel';

import { CaseThumbnail } from '../case-thumbnail';
import {
  formatIntegerViInput,
  formatDecimalViInput,
  parseViFloat,
  formatVND,
} from '@/utils/format';
import {
  DopplerBadge,
  FadeBadge,
  BlueGemBadge,
  MarbleFadeBadge,
} from '@/components/shared/pattern-badge';
import { estimateOverpay } from '@/services/pattern/overpay-calculator';

import { PortfolioTableRow } from '../portfolio-table-model';
import {
  getItemTypeColor,
  getItemTypeLabel,
  colorWithAlpha,
  toInputNumber,
} from '../portfolio-table-utils';

import { VirtualItemCard } from '../components/virtual-item-card';
import { AccountAllocationBreakdown } from '@/components/steam-accounts';
import { ItemLotsList } from '../components/item-lots-list';
import { calculateTradeHoldUntil } from '@/utils/date';

import { ItemHoldSection } from './item-hold-section';
import { ItemPriceSection } from './item-price-section';
import { ItemActions } from './item-actions';
import { StickerCharmSection } from './sticker-charm-section';

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
  onDirtyChange,
  onOpenDetails,
  useSellLabel = false,
  defaultEditing = false,
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
      patternInfo?: any;
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
  const [isEditing, setIsEditing] = useState(defaultEditing ?? false);
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

  useEffect(() => {
    if (defaultEditing) {
      setIsEditing(true);
    }
  }, [defaultEditing]);

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
  const handleInspect = async () => {
    if (!item.inspectLink) return;
    setInspectError(null);
    const res = await inspectPattern(item.inspectLink, item.case.marketHashName, item.dopplerPhase);
    if (res.success && res.data?.patternInfo) {
      const updatePayload = {
        dopplerPhase: res.data.patternInfo.dopplerPhase || item.dopplerPhase,
        patternInfo: res.data.patternInfo,
      };
      if (item.itemIds && item.itemIds.length > 0) {
        for (const id of item.itemIds) {
          await onUpdateLot?.(id, updatePayload);
        }
      } else {
        await onUpdateLot?.(item.id, updatePayload);
      }
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
      const updatePayload = {
        dopplerPhase: res.data.patternInfo.dopplerPhase || item.dopplerPhase,
        patternInfo: res.data.patternInfo,
        inspectLink: manualInspectLink.trim(),
      };
      if (item.itemIds && item.itemIds.length > 0) {
        for (const id of item.itemIds) {
          await onUpdateLot?.(id, updatePayload);
        }
      } else {
        await onUpdateLot?.(item.id, updatePayload);
      }
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
          const updatePayload = {
            dopplerPhase: scanRes.data.patternInfo.dopplerPhase || item.dopplerPhase,
            patternInfo: scanRes.data.patternInfo,
            inspectLink: data.inspectLink,
          };
          if (item.itemIds && item.itemIds.length > 0) {
            for (const id of item.itemIds) {
              await onUpdateLot?.(id, updatePayload);
            }
          } else {
            await onUpdateLot?.(item.id, updatePayload);
          }
        } else {
          setInspectError(scanRes.error || 'failedToInspectFromCSFloat');
          setFindStatus('error');
        }
      } else {
        setFindStatus('error');
      }
    } catch (err) {
      setFindStatus('error');
    } finally {
      setIsFindingLink(false);
    }
  };

  const initialHoldDays = useMemo(() => {
    if (!item.tradeHoldUntil) return 0;
    const parsedHoldUntil = new Date(item.tradeHoldUntil);
    if (isNaN(parsedHoldUntil.getTime())) return 0;
    const diffMs = parsedHoldUntil.getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, [item.tradeHoldUntil]);

  const initialIsProtected = Boolean(
    item.sourceAccounts?.[0]?.breakdown?.tradeProtected &&
    item.sourceAccounts[0].breakdown.tradeProtected > 0
  );

  const [editAccountId, setEditAccountId] = useState(
    () => item.sourceAccounts?.[0]?.steamId64 ?? ''
  );
  const [editStorageUnitId, setEditStorageUnitId] = useState(() => item.storageUnitId ?? '');
  const [editState, setEditState] = useState<'tradeable' | 'hold' | 'protected'>(() =>
    initialIsProtected ? 'protected' : initialHoldDays > 0 ? 'hold' : 'tradeable'
  );
  const [editHoldDays, setEditHoldDays] = useState(() =>
    initialHoldDays > 0 ? String(initialHoldDays) : ''
  );

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

      const lotHoldDays = (() => {
        if (!item.tradeHoldUntil) return 0;
        const parsedHoldUntil = new Date(item.tradeHoldUntil);
        if (isNaN(parsedHoldUntil.getTime())) return 0;
        const diffMs = parsedHoldUntil.getTime() - new Date().getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
      })();

      const isProtected = Boolean(
        item.sourceAccounts?.[0]?.breakdown?.tradeProtected &&
        item.sourceAccounts[0].breakdown.tradeProtected > 0
      );
      if (isProtected) {
        setEditState('protected');
        setEditHoldDays('');
      } else if (lotHoldDays > 0) {
        setEditState('hold');
        setEditHoldDays(String(lotHoldDays));
      } else {
        setEditState('tradeable');
        setEditHoldDays('');
      }

      setStickerRate(String(item.stickerPriceRate ?? 0));
      setStickerBuyRate(String(item.stickerBuyPriceRate ?? 0));
      setCapturedScanTotal(item.stickerScanTotalPrice ?? null);
      setCapturedScanDate(item.stickerScanPriceCapturedAt);
    }
  }, [
    item.id,
    item.quantity,
    item.buyPrice,
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
    const lotHoldDays = (() => {
      if (!item.tradeHoldUntil) return 0;
      const parsedHoldUntil = new Date(item.tradeHoldUntil);
      if (isNaN(parsedHoldUntil.getTime())) return 0;
      const diffMs = parsedHoldUntil.getTime() - new Date().getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    })();
    const isProtected = Boolean(
      item.sourceAccounts?.[0]?.breakdown?.tradeProtected &&
      item.sourceAccounts[0].breakdown.tradeProtected > 0
    );
    const defaultEditState = isProtected ? 'protected' : lotHoldDays > 0 ? 'hold' : 'tradeable';

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
      editState === defaultEditState &&
      (editState !== 'hold' || editHoldDays === String(lotHoldDays)) &&
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
      if (onUpdateLot) {
        let sourceAccounts = undefined;
        if (editAccountId) {
          const selectedAccount = accountOptions.find((acc) => acc.steamId64 === editAccountId);
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
            const baseDate = item.buyDate ? new Date(item.buyDate) : new Date();
            const holdDate = calculateTradeHoldUntil(baseDate, days);
            tradeHoldUntil = holdDate.toISOString();
          }
        }

        const targetId = relatedRows.length === 1 ? relatedRows[0].id : item.id;
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
        const targetId = relatedRows.length === 1 ? relatedRows[0].id : item.id;
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
    const lotHoldDays = (() => {
      if (!item.tradeHoldUntil) return 0;
      const parsedHoldUntil = new Date(item.tradeHoldUntil);
      if (isNaN(parsedHoldUntil.getTime())) return 0;
      const diffMs = parsedHoldUntil.getTime() - new Date().getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    })();
    const isProtected = Boolean(
      item.sourceAccounts?.[0]?.breakdown?.tradeProtected &&
      item.sourceAccounts[0].breakdown.tradeProtected > 0
    );
    if (isProtected) {
      setEditState('protected');
      setEditHoldDays('');
    } else if (lotHoldDays > 0) {
      setEditState('hold');
      setEditHoldDays(String(lotHoldDays));
    } else {
      setEditState('tradeable');
      setEditHoldDays('');
    }
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

        <div
          className={`flex items-center gap-4 border-b border-stone-800/40 px-4 py-4 ${
            embedded ? 'sticky top-0 z-10 bg-stone-950/95 pt-5 backdrop-blur-md' : ''
          }`}
          style={{
            backgroundImage: `linear-gradient(to right, ${colorWithAlpha(typeColor, 0.08)}, var(--card) 95%)`,
          }}
        >
          <div className="group relative flex shrink-0 items-center justify-center rounded-xl border border-stone-800 bg-stone-950/80 p-1.5 shadow-[inset_0_1.5px_3px_rgba(255,255,255,0.05)] transition-all duration-200">
            <CaseThumbnail imageUrl={item.case.imageUrl} name={item.case.name} size="lg" />
            <div
              className="absolute inset-0 -z-10 rounded-xl opacity-20 blur-md transition-opacity duration-300 group-hover:opacity-30"
              style={{ backgroundColor: typeColor }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-sm leading-snug font-extrabold tracking-wide text-stone-100"
              title={item.case.name}
            >
              {item.case.name}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span
                className="inline-flex rounded-md border px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase"
                style={{
                  backgroundColor: colorWithAlpha(typeColor, 0.12),
                  borderColor: colorWithAlpha(typeColor, 0.25),
                  color: typeColor,
                }}
              >
                {getItemTypeLabel(item.itemType)}
              </span>
              {item.dopplerPhase && <DopplerBadge phase={item.dopplerPhase} />}
              {item.patternInfo?.fadePercentage !== undefined && (
                <FadeBadge percentage={item.patternInfo.fadePercentage} />
              )}
              {item.patternInfo?.blueGemTier && item.patternInfo.blueGemTier !== 'Normal' && (
                <BlueGemBadge tier={item.patternInfo.blueGemTier} />
              )}
              {item.patternInfo?.marbleFadeTier && item.patternInfo.marbleFadeTier !== 'Normal' && (
                <MarbleFadeBadge tier={item.patternInfo.marbleFadeTier} />
              )}
              {item.case.rarity ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-stone-400">
                  <span
                    className="size-1.5 rounded-full shadow-sm"
                    style={{ backgroundColor: item.case.rarity.color }}
                  />
                  {item.case.rarity.name}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className={`p-4 ${embedded ? 'flex-1' : 'max-h-[440px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-800/80 hover:[&::-webkit-scrollbar-thumb]:bg-stone-700/80 [&::-webkit-scrollbar-track]:bg-transparent'}`}
        >
          <AccountAllocationBreakdown relatedRows={relatedRows} />

          {/* Interactive Pattern Inspect (if inspectLink is available) */}
          {relatedRows.length <= 1 &&
            item.itemType === 'skin' &&
            (item.inspectLink ? (
              <div className="mb-5 space-y-3 border-b border-stone-800/60 pb-5 text-xs">
                <div className="text-[10px] font-bold tracking-wider text-stone-500 uppercase">
                  {t('inventoryScanner.patternInfo', 'Thông tin Pattern')}
                </div>

                {!item.patternInfo ? (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-stone-800 bg-stone-900/60 p-3.5 text-center">
                    <div className="text-[11px] leading-relaxed text-stone-300">
                      {t(
                        'portfolio.patternInspectPrompt',
                        'Vật phẩm này có link inspect từ Steam. Bạn có muốn quét Pattern & Overpay không?'
                      )}
                    </div>
                    <button
                      onClick={handleInspect}
                      disabled={isInspecting}
                      className="bg-blue-650 flex h-8 w-full items-center justify-center rounded-lg text-xs font-bold text-white shadow-md transition-all hover:bg-blue-600 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                    >
                      {isInspecting ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <svg
                            className="h-3.5 w-3.5 animate-spin text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          {t('inventoryScanner.scanningPattern', 'Đang kiểm tra...')}
                        </span>
                      ) : (
                        t('inventoryScanner.inspectPatternButton', 'Kiểm tra Pattern')
                      )}
                    </button>
                    {inspectError && (
                      <div className="mt-1 text-[10px] font-semibold text-red-400">
                        {t(`inventoryScanner.apiErrors.${inspectError}`, inspectError)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {item.patternInfo.paintSeed !== undefined && (
                      <div className="flex justify-between text-stone-300">
                        <span>{t('inventoryScanner.paintSeed', 'Paint Seed')}</span>
                        <span className="font-semibold text-stone-100">
                          {item.patternInfo.paintSeed}
                        </span>
                      </div>
                    )}
                    {item.patternInfo.floatValue !== undefined && (
                      <div className="flex justify-between text-stone-300">
                        <span>{t('inventoryScanner.floatValue', 'Float Value')}</span>
                        <span className="font-semibold text-stone-100">
                          {item.patternInfo.floatValue.toFixed(8)}
                        </span>
                      </div>
                    )}
                    {(() => {
                      const buffPriceCny = buffPricesCny?.[item.case.marketHashName];
                      if (buffPriceCny && buffCnyToVndRate) {
                        const overpay = estimateOverpay(item.patternInfo, buffPriceCny);
                        if (overpay) {
                          return (
                            <div className="text-emerald-450 mt-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                              <div className="text-[10px] font-bold tracking-wider text-emerald-500 uppercase">
                                {t('inventoryScanner.overpayEstimate', 'Ước tính Overpay')} (
                                {overpay.multiplierSource})
                              </div>
                              <div className="mt-1 flex justify-between text-[11px] font-semibold">
                                <span>BUFF + Overpay:</span>
                                <span className="font-mono">
                                  {formatVND(
                                    Math.round(overpay.estimatedTypical * buffCnyToVndRate)
                                  )}{' '}
                                  <span className="font-sans text-[10px] font-normal text-stone-400">
                                    (
                                    {new Intl.NumberFormat('vi-VN').format(
                                      overpay.estimatedTypical
                                    )}{' '}
                                    x {new Intl.NumberFormat('vi-VN').format(buffCnyToVndRate)})
                                  </span>
                                </span>
                              </div>
                              <div className="mt-1 text-[9px] text-stone-400">
                                {t(
                                  'inventoryScanner.overpayDisclaimer',
                                  'Giá trị chỉ mang tính chất tham khảo dựa trên pattern.'
                                )}
                              </div>
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>
            ) : /* Paste Inspect Link section (if no inspectLink but is a skin) */
            item.patternInfo ? (
              /* If patternInfo is already scanned/present, display it statically */
              <div className="mb-5 space-y-3 border-b border-stone-800/60 pb-5 text-xs">
                <div className="text-[10px] font-bold tracking-wider text-stone-500 uppercase">
                  {t('inventoryScanner.patternInfo', 'Thông tin Pattern')}
                </div>
                <div className="grid gap-2">
                  {item.patternInfo.paintSeed !== undefined && (
                    <div className="flex justify-between text-stone-300">
                      <span>{t('inventoryScanner.paintSeed', 'Paint Seed')}</span>
                      <span className="font-semibold text-stone-100">
                        {item.patternInfo.paintSeed}
                      </span>
                    </div>
                  )}
                  {item.patternInfo.floatValue !== undefined && (
                    <div className="flex justify-between text-stone-300">
                      <span>{t('inventoryScanner.floatValue', 'Float Value')}</span>
                      <span className="font-semibold text-stone-100">
                        {item.patternInfo.floatValue.toFixed(8)}
                      </span>
                    </div>
                  )}
                  {(() => {
                    const buffPriceCny = buffPricesCny?.[item.case.marketHashName];
                    if (buffPriceCny && buffCnyToVndRate) {
                      const overpay = estimateOverpay(item.patternInfo, buffPriceCny);
                      if (overpay) {
                        return (
                          <div className="text-emerald-450 mt-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                            <div className="text-[10px] font-bold tracking-wider text-emerald-500 uppercase">
                              {t('inventoryScanner.overpayEstimate', 'Ước tính Overpay')} (
                              {overpay.multiplierSource})
                            </div>
                            <div className="mt-1 flex justify-between text-[11px] font-semibold">
                              <span>BUFF + Overpay:</span>
                              <span className="font-mono">
                                {formatVND(Math.round(overpay.estimatedTypical * buffCnyToVndRate))}{' '}
                                <span className="font-sans text-[10px] font-normal text-stone-400">
                                  ({new Intl.NumberFormat('vi-VN').format(overpay.estimatedTypical)}{' '}
                                  x {new Intl.NumberFormat('vi-VN').format(buffCnyToVndRate)})
                                </span>
                              </span>
                            </div>
                            <div className="mt-1 text-[9px] text-stone-400">
                              {t(
                                'inventoryScanner.overpayDisclaimer',
                                'Giá trị chỉ mang tính chất tham khảo dựa trên pattern.'
                              )}
                            </div>
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                </div>
              </div>
            ) : item.itemType === 'skin' ? (
              /* If no inspectLink, no patternInfo, and it is a skin, let the user enter manual inspectLink */
              <div className="mb-5 space-y-3 border-b border-stone-800/60 pb-5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold tracking-wider text-stone-500 uppercase">
                    {t('inventoryScanner.patternInfo', 'Thông tin Pattern')}
                  </div>
                  <button
                    onClick={handleAutoFind}
                    disabled={isFindingLink || isInspecting}
                    className="text-blue-450 hover:text-blue-350 flex items-center gap-1 text-[10px] font-semibold disabled:opacity-50"
                  >
                    {isFindingLink ? (
                      <>
                        <svg
                          className="text-blue-450 h-3 w-3 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        {t('portfolio.findingLink', 'Đang tìm...')}
                      </>
                    ) : (
                      t('portfolio.autoFindInspectLink', 'Tự động tìm link')
                    )}
                  </button>
                </div>
                <div className="flex flex-col gap-3 rounded-xl border border-stone-800 bg-stone-900/60 p-3.5">
                  <div className="text-center text-[11px] leading-relaxed text-stone-300">
                    {t(
                      'portfolio.noInspectLinkPrompt',
                      'Dán Inspect Link từ Steam để kiểm tra Pattern & Overpay:'
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="steam://rungame/730/... +csgo_econ_action_preview%20..."
                      value={manualInspectLink}
                      onChange={(e) => setManualInspectLink(e.target.value)}
                      className="border-stone-805 h-9 w-full rounded-lg border bg-stone-950 px-3 text-xs text-stone-200 transition-all placeholder:text-stone-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:outline-none"
                    />
                    <button
                      onClick={handleManualInspect}
                      disabled={isInspecting || !manualInspectLink.trim()}
                      className="bg-blue-650 flex h-8 w-full items-center justify-center rounded-lg text-xs font-bold text-white shadow-md transition-all hover:bg-blue-600 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                    >
                      {isInspecting ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <svg
                            className="h-3.5 w-3.5 animate-spin text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          {t('inventoryScanner.scanningPattern', 'Đang kiểm tra...')}
                        </span>
                      ) : (
                        t('inventoryScanner.inspectPatternButton', 'Kiểm tra Pattern')
                      )}
                    </button>
                  </div>
                  {findStatus === 'error' && (
                    <div className="mt-1 text-center text-[10px] font-semibold text-amber-400">
                      {t(
                        'portfolio.autoFindNotFound',
                        'Không tìm thấy Inspect Link trong dữ liệu scan kho đồ của bạn. Hãy quét lại kho đồ hoặc dán thủ công.'
                      )}
                    </div>
                  )}
                  {findStatus === 'success' && (
                    <div className="mt-1 text-center text-[10px] font-semibold text-emerald-400">
                      {t(
                        'portfolio.autoFindSuccess',
                        'Đã tìm thấy link! Đang tiến hành kiểm tra...'
                      )}
                    </div>
                  )}
                  {inspectError && (
                    <div className="mt-1 text-center text-[10px] font-semibold text-red-400">
                      {t(`inventoryScanner.apiErrors.${inspectError}`, inspectError)}
                    </div>
                  )}
                </div>
              </div>
            ) : null)}

          {item.storageUnitDetails && item.storageUnitDetails.length > 0 && (
            <div className="mb-5 space-y-3 border-b border-stone-800/60 pb-5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-stone-500 uppercase">
                <TbPackage className="size-3.5 text-stone-400" />
                {t('portfolio.storageUnitAllocation', 'Stored in Storage Unit')}
              </div>
              <div className="grid gap-2">
                {item.storageUnitDetails.map((su) => {
                  const account = accountOptions.find((a) => a.steamId64 === su.steamId64);
                  const accountName = account ? account.name : '';
                  return (
                    <div
                      key={su.storageUnitId}
                      className="flex items-center justify-between rounded-xl border border-stone-800/40 bg-stone-950/20 px-3 py-2.5 transition duration-200 hover:bg-stone-900/10"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-stone-300">
                        <span className="flex size-5.5 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                          <TbPackage className="size-3" />
                        </span>
                        <span className="truncate">{su.storageUnitName}</span>
                        {accountName && (
                          <span className="inline-flex max-w-[7rem] shrink-0 items-center gap-0.5 truncate rounded border border-sky-500/10 bg-sky-500/5 px-1.5 py-0.5 text-[8.5px] font-bold tracking-wide text-sky-400">
                            {accountName}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-mono text-xs font-extrabold text-amber-400">
                        {su.quantity}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {relatedRows.length <= 1 ? (
            <div
              className={`space-y-4 transition-all duration-350 ${isResetting ? 'animate-reset-flash' : ''}`}
            >
              <ItemHoldSection
                item={item}
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
              />

              {(() => {
                const stickers = item.patternInfo?.stickers ?? [];
                const charms = item.patternInfo?.charms ?? [];
                const hasAccessories = stickers.length > 0 || charms.length > 0;
                const hasScanSnapshot = (capturedScanTotal ?? item.stickerScanTotalPrice ?? 0) > 0;

                return (
                  <>
                    <StickerCharmSection
                      patternInfo={item.patternInfo}
                      skinPrice={item.currentPrice ?? item.steamPrice ?? 0}
                      buyPrice={parseViFloat(priceVnd)}
                      savedStickerRate={item.stickerPriceRate}
                      savedStickerBuyRate={item.stickerBuyPriceRate}
                      stickerBuyRate={stickerBuyRate}
                      stickerRate={stickerRate}
                      stickerScanTotalPrice={capturedScanTotal ?? undefined}
                      stickerScanPriceCapturedAt={capturedScanDate}
                      onStickerBuyRateChange={setStickerBuyRate}
                      onStickerRateChange={setStickerRate}
                      onStickerFormulaTotalChange={setStickerFormulaTotal}
                      onStickerTotalPriceChange={(val) => setPriceVnd(formatIntegerViInput(val))}
                      shouldApplyStickerTotal={true}
                      readOnly={readOnly}
                    />

                    <ItemPriceSection
                      item={item}
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
                      priceVnd={priceVnd}
                      updateVnd={updateVnd}
                      submit={submit}
                      showStickerFormulaTotal={hasAccessories && hasScanSnapshot}
                      stickerFormulaTotalPrice={stickerFormulaTotal}
                      hasBuff={hasBuff}
                      useSellLabel={useSellLabel}
                      isGuest={isGuest}
                    />
                  </>
                );
              })()}
            </div>
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
