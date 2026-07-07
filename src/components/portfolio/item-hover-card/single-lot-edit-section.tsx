import { formatIntegerViInput, parseViFloat } from '@/utils/format';

import type { PortfolioTableRow } from '../portfolio-table-model';
import { ItemHoldSection } from './item-hold-section';
import { ItemPriceSection } from './item-price-section';
import { StickerCharmSection } from './sticker-charm-section';

type ItemTradeState = 'tradeable' | 'hold' | 'protected';
type AccountOption = { id: string; steamId64: string; name: string };
type StorageUnitOption = { id: string; name: string; currentCount: number };

type SingleLotEditSectionProps = {
  item: PortfolioTableRow;
  isResetting: boolean;
  editAccountId: string;
  setEditAccountId: (value: string) => void;
  editStorageUnitId: string;
  setEditStorageUnitId: (value: string) => void;
  editState: ItemTradeState;
  setEditState: (value: ItemTradeState) => void;
  editHoldDays: string;
  setEditHoldDays: (value: string) => void;
  accounts: AccountOption[];
  storageUnits?: StorageUnitOption[];
  onSelectOpenChange?: (open: boolean) => void;
  priceVnd: string;
  setPriceVnd: (value: string) => void;
  quantity: string;
  setQuantity: (value: string) => void;
  priceCny: string;
  updateCny: (value: string) => void;
  buyRate: string;
  updateBuyRate: (value: string) => void;
  sellRate: string;
  updateSellRate: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  updateVnd: (value: string) => void;
  submit: () => void;
  stickerBuyRate: string;
  setStickerBuyRate: (value: string) => void;
  stickerRate: string;
  setStickerRate: (value: string) => void;
  capturedScanTotal: number | null;
  capturedScanDate?: string;
  setStickerFormulaTotal: (value: number) => void;
  stickerFormulaTotal: number | null;
  hasBuff: boolean;
  useSellLabel?: boolean;
  isGuest?: boolean;
  readOnly?: boolean;
};

export function SingleLotEditSection({
  item,
  isResetting,
  editAccountId,
  setEditAccountId,
  editStorageUnitId,
  setEditStorageUnitId,
  editState,
  setEditState,
  editHoldDays,
  setEditHoldDays,
  accounts,
  storageUnits,
  onSelectOpenChange,
  priceVnd,
  setPriceVnd,
  quantity,
  setQuantity,
  priceCny,
  updateCny,
  buyRate,
  updateBuyRate,
  sellRate,
  updateSellRate,
  note,
  setNote,
  updateVnd,
  submit,
  stickerBuyRate,
  setStickerBuyRate,
  stickerRate,
  setStickerRate,
  capturedScanTotal,
  capturedScanDate,
  setStickerFormulaTotal,
  stickerFormulaTotal,
  hasBuff,
  useSellLabel,
  isGuest,
  readOnly,
}: SingleLotEditSectionProps) {
  const stickers = item.patternInfo?.stickers ?? [];
  const charms = item.patternInfo?.charms ?? [];
  const hasAccessories = stickers.length > 0 || charms.length > 0;
  const hasScanSnapshot = (capturedScanTotal ?? item.stickerScanTotalPrice ?? 0) > 0;

  return (
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
        accounts={accounts}
        storageUnits={storageUnits}
        onSelectOpenChange={onSelectOpenChange}
      />

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
        onStickerTotalPriceChange={(value) => setPriceVnd(formatIntegerViInput(value))}
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
    </div>
  );
}
