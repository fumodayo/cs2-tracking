'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SlidePanel, SlidePanelContent } from '@/components/ui/slide-panel';

import { formatIntegerViInput, formatDecimalViInput, parseViFloat } from '@/utils/format';

import { PortfolioTableRow } from '../portfolio-table-model';
import { getItemTypeColor } from '../portfolio-table-utils';

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
  getItemHoverCardTargetId,
  getTradeHoldUntilForState,
  type ItemTradeState,
} from './lot-update-helpers';
import {
  getItemHoverCardDefaultFormValues,
  getItemHoverCardDraftFormValues,
  type ItemHoverCardFormValues,
} from './item-hover-card-form-values';
import { useItemPatternInspectControls } from './use-item-pattern-inspect-controls';
import { useItemHoverCardAccounts } from './use-item-hover-card-accounts';
import {
  applyManualOwnershipPreferences,
  readManualOwnershipPreferences,
  writeManualOwnershipPreferences,
} from './manual-ownership-preferences';

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

  const defaultFormValues = useMemo(
    () => getItemHoverCardDefaultFormValues({ item, hasBuff, buffCnyToVndRate, buffPricesCny }),
    [item, hasBuff, buffCnyToVndRate, buffPricesCny]
  );

  const [quantity, setQuantity] = useState(() => defaultFormValues.quantity);
  const [priceCny, setPriceCny] = useState(() => defaultFormValues.priceCny);
  const [buyRate, setBuyRate] = useState(() => defaultFormValues.buyRate);
  const [priceVnd, setPriceVnd] = useState(() => defaultFormValues.priceVnd);
  const [note, setNote] = useState(() => defaultFormValues.note);
  const [saving, setSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [sellRate, setSellRate] = useState(() => defaultFormValues.sellRate);
  const [sellPriceCny, setSellPriceCny] = useState(() => defaultFormValues.sellPriceCny);

  const [stickerRate, setStickerRate] = useState(() => defaultFormValues.stickerRate);
  const [stickerBuyRate, setStickerBuyRate] = useState(() => defaultFormValues.stickerBuyRate);
  const [stickerFormulaTotal, setStickerFormulaTotal] = useState<number | null>(null);
  const [capturedScanTotal, setCapturedScanTotal] = useState<number | null>(
    () => defaultFormValues.capturedScanTotal
  );
  const [capturedScanDate, setCapturedScanDate] = useState<string | undefined>(
    () => defaultFormValues.capturedScanDate
  );

  const {
    isInspecting,
    inspectError,
    manualInspectLink,
    setManualInspectLink,
    handleInspect,
    handleManualInspect,
    handleAutoFind,
    isFindingLink,
    findStatus,
  } = useItemPatternInspectControls({ item, onUpdateLot });

  const [editAccountId, setEditAccountId] = useState(() => defaultFormValues.editAccountId);
  const [editStorageUnitId, setEditStorageUnitId] = useState(
    () => defaultFormValues.editStorageUnitId
  );
  const [editState, setEditState] = useState<ItemTradeState>(() => defaultFormValues.editState);
  const [editHoldDays, setEditHoldDays] = useState(() => defaultFormValues.editHoldDays);

  const { accountOptions, storageUnits } = useItemHoverCardAccounts({ item, editAccountId });

  const isVirtual = item.sourceType === 'existing' && item.isVirtual;

  const applyFormValues = useCallback((values: ItemHoverCardFormValues, includeSellRate = true) => {
    setQuantity(values.quantity);
    setPriceCny(values.priceCny);
    setBuyRate(values.buyRate);
    setPriceVnd(values.priceVnd);
    setNote(values.note);
    if (includeSellRate) {
      setSellRate(values.sellRate);
    }
    setSellPriceCny(values.sellPriceCny);
    setEditAccountId(values.editAccountId);
    setEditStorageUnitId(values.editStorageUnitId);
    setEditState(values.editState);
    setEditHoldDays(values.editHoldDays);
    setStickerRate(values.stickerRate);
    setStickerBuyRate(values.stickerBuyRate);
    setCapturedScanTotal(values.capturedScanTotal);
    setCapturedScanDate(values.capturedScanDate);
  }, []);

  // Nạp bản nháp từ localStorage khi mount/props đổi, fallback về giá trị props
  useEffect(() => {
    let nextValues = defaultFormValues;
    let loadedFromDraft = false;
    try {
      const saved = localStorage.getItem(`item_hover_card_draft_${item.id}`);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft) {
          nextValues = getItemHoverCardDraftFormValues({
            item,
            draft,
            hasBuff,
            buffCnyToVndRate,
            buffPricesCny,
          });
          loadedFromDraft = true;
        }
      }
    } catch (e) {
      console.error('Failed to parse item draft from localStorage', e);
    }

    if (!loadedFromDraft && item.sourceType === 'manual') {
      nextValues = applyManualOwnershipPreferences(
        nextValues,
        item.sourceType,
        readManualOwnershipPreferences(localStorage)
      );
    }

    applyFormValues(nextValues, !loadedFromDraft);
  }, [item, defaultFormValues, hasBuff, buffCnyToVndRate, buffPricesCny, applyFormValues]);

  // Kiểm tra giá trị form có khớp giá trị mặc định từ props không
  const isDefault = useMemo(() => {
    return (
      parseViFloat(quantity) === parseViFloat(defaultFormValues.quantity) &&
      parseViFloat(priceVnd) === parseViFloat(defaultFormValues.priceVnd) &&
      parseViFloat(priceCny) === parseViFloat(defaultFormValues.priceCny) &&
      parseViFloat(buyRate) === parseViFloat(defaultFormValues.buyRate) &&
      note === defaultFormValues.note &&
      editAccountId === defaultFormValues.editAccountId &&
      editStorageUnitId === defaultFormValues.editStorageUnitId &&
      editState === defaultFormValues.editState &&
      (editState !== 'hold' || editHoldDays === defaultFormValues.editHoldDays) &&
      parseViFloat(stickerRate) === parseViFloat(defaultFormValues.stickerRate) &&
      parseViFloat(stickerBuyRate) === parseViFloat(defaultFormValues.stickerBuyRate) &&
      capturedScanTotal === defaultFormValues.capturedScanTotal &&
      capturedScanDate === defaultFormValues.capturedScanDate &&
      parseViFloat(sellPriceCny) === parseViFloat(defaultFormValues.sellPriceCny) &&
      parseViFloat(sellRate) === parseViFloat(defaultFormValues.sellRate)
    );
  }, [
    defaultFormValues,
    quantity,
    priceVnd,
    priceCny,
    buyRate,
    note,
    editAccountId,
    editStorageUnitId,
    editState,
    editHoldDays,
    stickerRate,
    stickerBuyRate,
    capturedScanTotal,
    capturedScanDate,
    sellPriceCny,
    sellRate,
  ]);

  // Tự lưu bản nháp khi có thay đổi
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
          sellPriceCny,
          sellRate,
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
    sellPriceCny,
    sellRate,
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
    if (hasBuff && Number.isFinite(vnd)) {
      const rate = parseViFloat(buyRate);
      if (Number.isFinite(rate) && rate > 0) {
        setPriceCny(formatDecimalViInput(vnd / rate));
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
      if (hasBuff && onUpdateBuffPrice) {
        const nextSellPriceCny = parseViFloat(sellPriceCny);
        if (
          Number.isFinite(nextSellPriceCny) &&
          nextSellPriceCny !== (buffPricesCny?.[item.case.marketHashName] ?? 0)
        ) {
          await onUpdateBuffPrice(item.case.marketHashName, nextSellPriceCny);
        }
      }
      if (item.sourceType === 'manual') {
        writeManualOwnershipPreferences(localStorage, {
          editAccountId,
          editStorageUnitId,
          editState,
          editHoldDays,
        });
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
    applyFormValues(defaultFormValues);
    setStickerFormulaTotal(null);
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
              storageUnits={storageUnits}
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
              sellPriceCny={sellPriceCny}
              setSellPriceCny={setSellPriceCny}
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
