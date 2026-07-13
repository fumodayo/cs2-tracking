import { formatIntegerViInput, parseViFloat, formatVND } from '@/utils/format';
import { useAccessoryPrices } from '@/hooks/use-accessory-prices';
import { useTranslation } from 'react-i18next';

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
  sellPriceCny: string;
  setSellPriceCny: (value: string) => void;
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
  sellPriceCny,
  setSellPriceCny,
  hasBuff,
  useSellLabel,
  isGuest,
  readOnly,
}: SingleLotEditSectionProps) {
  const { t } = useTranslation();
  const stickers = item.patternInfo?.stickers ?? [];
  const charms = item.patternInfo?.charms ?? [];
  const hasAccessories = stickers.length > 0 || charms.length > 0;
  const hasScanSnapshot = (capturedScanTotal ?? item.stickerScanTotalPrice ?? 0) > 0;

  const { totalPrice: currentAccessoryTotal } = useAccessoryPrices(stickers, charms);
  const scanAccessoryTotal = Math.max(0, capturedScanTotal ?? item.stickerScanTotalPrice ?? 0);

  const parseRate = (valStr: string) => {
    const val = parseFloat(valStr);
    return Number.isNaN(val) ? 0 : Math.max(0, val);
  };

  const formulaRate = useSellLabel ? parseRate(stickerRate) : parseRate(stickerBuyRate);
  const formulaAccessoryTotal = useSellLabel ? currentAccessoryTotal : scanAccessoryTotal;

  let formulaBasePrice = 0;
  if (useSellLabel) {
    const savedStickerRate = item.stickerPriceRate ?? 0;
    const savedCurrentAddValue = Math.round((currentAccessoryTotal * savedStickerRate) / 100);
    const skinPrice = item.currentPrice ?? item.steamPrice ?? 0;
    formulaBasePrice = Math.max(0, skinPrice - savedCurrentAddValue);
  } else {
    const savedStickerBuyRate = item.stickerBuyPriceRate ?? 0;
    const savedBuyAddValue = Math.round((scanAccessoryTotal * savedStickerBuyRate) / 100);
    const buyPrice = parseViFloat(priceVnd);
    formulaBasePrice = Math.max(0, buyPrice - savedBuyAddValue);
  }

  // 1. Calculate Secondary Card values
  const showSecondaryCard = !isGuest;
  const secondaryLabel = useSellLabel
    ? t('portfolio.unitBuyPriceVnd', 'Đơn giá mua (VND)')
    : t('portfolio.unitSellPriceVnd', 'Đơn giá bán (VND)');

  let secBaseSkinPrice = 0;
  let secAccessoryTotal = 0;
  let secRate = 0;
  let secFormulaTotalPrice = 0;

  const parsedQty = parseViFloat(quantity) || 1;

  if (useSellLabel) {
    // Secondary is Buy price
    const buyRateNum = parseViFloat(buyRate) || 3600;
    const sellPriceCnyNum = parseViFloat(sellPriceCny) || 0;

    if (hasBuff) {
      secBaseSkinPrice = Math.round(sellPriceCnyNum * buyRateNum);
    } else {
      secBaseSkinPrice = item.buyPrice || item.steamPrice || 0;
    }

    secAccessoryTotal = scanAccessoryTotal;
    secRate = parseRate(stickerBuyRate);
    const buyAddedValue = Math.round((secAccessoryTotal * secRate) / 100);
    secFormulaTotalPrice = secBaseSkinPrice + buyAddedValue;
  } else {
    // Secondary is Sell price
    const sellRateNum = parseViFloat(sellRate) || 3600;
    const sellCnyNum = parseViFloat(sellPriceCny) || 0;

    if (hasBuff) {
      secBaseSkinPrice = Math.round(sellCnyNum * sellRateNum);
    } else {
      secBaseSkinPrice = item.currentPrice || item.steamPrice || 0;
    }

    secAccessoryTotal = currentAccessoryTotal;
    secRate = parseRate(stickerRate);
    const sellAddedValue = Math.round((secAccessoryTotal * secRate) / 100);
    secFormulaTotalPrice = secBaseSkinPrice + sellAddedValue;
  }

  const secondaryFormulaDisplay = formatVND(secFormulaTotalPrice);
  const secondaryLotTotal = secFormulaTotalPrice * parsedQty;
  const secondaryLotTotalText = `${
    useSellLabel
      ? t('portfolio.totalInvestedValue', 'Tổng vốn')
      : t('portfolio.totalSellValue', 'Tổng giá bán')
  }: ${formatVND(secondaryLotTotal)}`;

  const secondaryFormulaText =
    hasAccessories && hasScanSnapshot
      ? `${Math.round(secBaseSkinPrice).toLocaleString('vi-VN')} + (${Math.round(secAccessoryTotal).toLocaleString('vi-VN')} × ${Math.round(secRate)}%) = ${secondaryFormulaDisplay}`
      : undefined;

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
        stickerFormulaBasePrice={formulaBasePrice}
        stickerFormulaAccessoryTotal={formulaAccessoryTotal}
        stickerFormulaRate={formulaRate}
        showSecondaryCard={showSecondaryCard}
        secondaryLabel={secondaryLabel}
        secondaryLotTotalText={secondaryLotTotalText}
        secondaryFormulaDisplay={secondaryFormulaDisplay}
        secondaryFormulaText={secondaryFormulaText}
        sellPriceCny={sellPriceCny}
        updateSellPriceCny={setSellPriceCny}
      />
    </div>
  );
}
