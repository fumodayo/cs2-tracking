'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  STEAM_ACCOUNTS_QUERY_KEY,
  STORAGE_UNITS_QUERY_KEY,
  fetchSteamAccounts,
  fetchAccountStorageUnits,
} from '@/lib/api-client/steam-accounts-api';
import { type CaseItemSearchData } from '../case-search-select';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  formatInputDate,
  formatIntegerViInput as formatIntegerVi,
  formatDecimalViInput as formatDecimalVi,
  parseViFloat,
} from '@/utils/format';
import { calculateTradeHoldUntil } from '@/utils/date';

import { FormValues } from './add-case-dialog/types';
import { CaseSelectionSection } from './add-case-dialog/case-selection-section';
import { PricingFormulaSection } from './add-case-dialog/pricing-formula-section';
import { QuantityDateSection } from './add-case-dialog/quantity-date-section';
import { LocationSelectionSection } from './add-case-dialog/location-selection-section';
import { StatusSection } from './add-case-dialog/status-section';
import { getSavedBuffPriceCny } from '../add-item-pricing';
import {
  readManualOwnershipPreferences,
  writeManualOwnershipPreferences,
  type ManualOwnershipPreferences,
} from '../item-hover-card/manual-ownership-preferences';

const EMPTY_MANUAL_OWNERSHIP_PREFERENCES: ManualOwnershipPreferences = {
  editAccountId: '',
  editStorageUnitId: '',
  editState: 'tradeable',
  editHoldDays: '',
};

type AddCaseDialogProps = {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    caseId: string;
    quantity: number;
    buyPrice: number;
    buyDate: string;
    sourceAccounts?: Array<{
      steamId64: string;
      name: string;
      breakdown?: {
        tradeable: number;
        onMarket: number;
        tradeProtected: number;
        hold: number;
        holdDetails?: Array<{ quantity: number; holdDays: number }>;
      };
    }>;
    storageUnitId?: string;
    tradeHoldUntil?: string | null;
  }) => Promise<void>;
  defaultBuffRate?: number;
  buffPricesCny?: Record<string, number>;
};

export function AddCaseDialog({
  open,
  saving,
  onClose,
  onSubmit,
  defaultBuffRate = 3600,
  buffPricesCny,
}: AddCaseDialogProps) {
  const { t } = useTranslation();
  const [selectedCase, setSelectedCase] = useState<CaseItemSearchData | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [marketPrice, setMarketPrice] = useState(0);
  const [manualOwnershipDefaults, setManualOwnershipDefaults] =
    useState<ManualOwnershipPreferences>(EMPTY_MANUAL_OWNERSHIP_PREFERENCES);

  const form = useForm<FormValues>({
    defaultValues: {
      quantity: '1',
      buyPrice: '',
      buyDate: formatInputDate(new Date()),
      buffPrice: '',
      buffRate: formatIntegerVi(defaultBuffRate),
      accountId: '',
      storageUnitId: '',
      itemState: 'tradeable',
      holdDays: '',
    },
  });

  const { control, setValue, handleSubmit: formSubmit, reset } = form;

  const accountId = useWatch({ control, name: 'accountId' });
  const itemState = useWatch({ control, name: 'itemState' });
  const buffPrice = useWatch({ control, name: 'buffPrice' });
  const buffRate = useWatch({ control, name: 'buffRate' });
  const buyPrice = useWatch({ control, name: 'buyPrice' });
  const quantity = useWatch({ control, name: 'quantity' });
  const buyDate = useWatch({ control, name: 'buyDate' });
  const savedBuffPriceCny = getSavedBuffPriceCny(selectedCase?.marketHashName, buffPricesCny);
  const hasBuff = savedBuffPriceCny !== null;

  // Lấy tài khoản đã liên kết
  const accountsQuery = useQuery({
    queryKey: STEAM_ACCOUNTS_QUERY_KEY,
    queryFn: () => fetchSteamAccounts(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);

  const selectedAccount = useMemo(() => {
    return accounts.find((acc) => acc.id === accountId || acc.steamId64 === accountId);
  }, [accounts, accountId]);

  const selectedSteamId = selectedAccount?.steamId64 ?? '';

  // Lấy storage unit cho tài khoản đang chọn
  const storageUnitsQuery = useQuery({
    queryKey: STORAGE_UNITS_QUERY_KEY(selectedSteamId),
    queryFn: () => fetchAccountStorageUnits(selectedSteamId),
    enabled: open && Boolean(selectedSteamId),
    staleTime: 5 * 60 * 1000,
  });

  const storageUnits = storageUnitsQuery.data ?? [];

  const canSubmit = useMemo(
    () =>
      selectedCase &&
      Number(quantity.replace(/\D/g, '')) > 0 &&
      parseViFloat(buyPrice) > 0 &&
      buyDate,
    [buyDate, buyPrice, quantity, selectedCase]
  );

  // Nạp bản nháp hoặc reset trạng thái khi dialog mở
  useEffect(() => {
    if (open) {
      const ownershipDefaults =
        readManualOwnershipPreferences(localStorage) ?? EMPTY_MANUAL_OWNERSHIP_PREFERENCES;
      setManualOwnershipDefaults(ownershipDefaults);

      try {
        const savedDraft = localStorage.getItem('add_case_dialog_draft');
        if (savedDraft) {
          const draft = JSON.parse(savedDraft);
          if (draft.selectedCase) {
            setSelectedCase(draft.selectedCase);
            setMarketPrice(Number(draft.marketPrice) || 0);
          } else {
            setSelectedCase(null);
            setMarketPrice(0);
          }
          if (draft.formValues) {
            reset(draft.formValues);
            return;
          }
        }
      } catch (e) {
        console.error('Failed to load draft from localStorage', e);
      }

      // Reset mặc định nếu không có bản nháp
      setSelectedCase(null);
      setMarketPrice(0);
      reset(getDefaultFormValues(defaultBuffRate, ownershipDefaults));
    }
  }, [open, defaultBuffRate, reset]);

  const watchedValues = useWatch({ control });

  // Lưu trạng thái vào localStorage làm bản nháp
  useEffect(() => {
    if (open) {
      // Kiểm tra giá trị mặc định/rỗng để dọn bản nháp
      const isDefault =
        !selectedCase &&
        watchedValues.quantity === '1' &&
        !watchedValues.buyPrice &&
        !watchedValues.buffPrice &&
        watchedValues.buffRate === formatIntegerVi(defaultBuffRate) &&
        watchedValues.accountId === manualOwnershipDefaults.editAccountId &&
        watchedValues.storageUnitId === manualOwnershipDefaults.editStorageUnitId &&
        watchedValues.itemState === manualOwnershipDefaults.editState &&
        watchedValues.holdDays === manualOwnershipDefaults.editHoldDays;

      try {
        if (isDefault) {
          localStorage.removeItem('add_case_dialog_draft');
        } else {
          const draft = {
            selectedCase,
            marketPrice,
            formValues: watchedValues,
          };
          localStorage.setItem('add_case_dialog_draft', JSON.stringify(draft));
        }
      } catch (e) {
        console.error('Failed to update draft in localStorage', e);
      }
    }
  }, [open, selectedCase, marketPrice, watchedValues, defaultBuffRate, manualOwnershipDefaults]);

  // Tính lại buyPrice khi buffPrice hoặc buffRate thay đổi
  const recalcBuyPrice = useCallback(
    (price: string, rate: string) => {
      const priceNum = parseViFloat(price);
      const rateNum = parseViFloat(rate);
      if (!isNaN(priceNum) && !isNaN(rateNum)) {
        setValue('buyPrice', formatIntegerVi(Math.round(priceNum * rateNum)));
      } else if (!price && !rate) {
        setValue('buyPrice', '');
      }
    },
    [setValue]
  );

  // Tính lại buffPrice khi buyPrice hoặc buffRate thay đổi
  const recalcBuffPrice = useCallback(
    (buyPriceVal: string, rate: string) => {
      const buyPriceNum = parseViFloat(buyPriceVal);
      const rateNum = parseViFloat(rate);
      if (!isNaN(buyPriceNum) && !isNaN(rateNum) && rateNum > 0) {
        setValue('buffPrice', formatDecimalVi(buyPriceNum / rateNum));
      } else if (!buyPriceVal) {
        setValue('buffPrice', '');
      }
    },
    [setValue]
  );

  const handleBuffPriceChange = useCallback(
    (val: string) => {
      const formatted = formatDecimalVi(val);
      setValue('buffPrice', formatted);
      recalcBuyPrice(formatted, buffRate);
    },
    [setValue, recalcBuyPrice, buffRate]
  );

  const handleBuffRateChange = useCallback(
    (val: string) => {
      const formatted = formatIntegerVi(val);
      setValue('buffRate', formatted);
      recalcBuyPrice(buffPrice, formatted);
    },
    [setValue, recalcBuyPrice, buffPrice]
  );

  const handleBuyPriceChange = useCallback(
    (val: string) => {
      const formatted = formatIntegerVi(val);
      setValue('buyPrice', formatted);
      if (hasBuff) {
        recalcBuffPrice(formatted, buffRate);
      }
    },
    [setValue, recalcBuffPrice, buffRate, hasBuff]
  );

  const handleAccountChange = useCallback(
    (val: string) => {
      setValue('accountId', val === '__manual__' ? '' : val);
      setValue('storageUnitId', '');
    },
    [setValue]
  );

  async function onFormSubmit(data: FormValues) {
    if (!selectedCase || !canSubmit) return;

    const accountInfo = selectedAccount
      ? { steamId64: selectedAccount.steamId64, name: selectedAccount.name }
      : { steamId64: 'manual', name: t('common.manual', 'Manual') };

    const parsedQuantity = Number(data.quantity.replace(/\D/g, '')) || 1;
    const parsedBuyPrice = parseViFloat(data.buyPrice) || 0;

    const breakdown = {
      tradeable: data.itemState === 'tradeable' ? parsedQuantity : 0,
      onMarket: 0,
      tradeProtected: data.itemState === 'protected' ? parsedQuantity : 0,
      hold: data.itemState === 'hold' ? parsedQuantity : 0,
      holdDetails:
        data.itemState === 'hold'
          ? [
              {
                quantity: parsedQuantity,
                holdDays: Number(data.holdDays) || 0,
              },
            ]
          : [],
    };

    const sourceAccounts = [
      {
        ...accountInfo,
        breakdown,
      },
    ];

    let tradeHoldUntil = null;
    if (data.itemState === 'hold' && data.holdDays) {
      const days = Number(data.holdDays) || 0;
      if (days > 0) {
        const baseDate = data.buyDate ? new Date(data.buyDate) : new Date();
        const holdDate = calculateTradeHoldUntil(baseDate, days);
        tradeHoldUntil = holdDate.toISOString();
      }
    }

    await onSubmit({
      caseId: selectedCase.id,
      quantity: parsedQuantity,
      buyPrice: parsedBuyPrice,
      buyDate: data.buyDate,
      sourceAccounts,
      storageUnitId: data.storageUnitId || undefined,
      tradeHoldUntil,
    });

    const nextOwnershipDefaults: ManualOwnershipPreferences = {
      editAccountId: selectedAccount?.steamId64 ?? '',
      editStorageUnitId: selectedAccount ? data.storageUnitId : '',
      editState: data.itemState,
      editHoldDays: data.itemState === 'tradeable' ? '' : data.holdDays,
    };
    writeManualOwnershipPreferences(localStorage, nextOwnershipDefaults);
    setManualOwnershipDefaults(nextOwnershipDefaults);

    try {
      localStorage.removeItem('add_case_dialog_draft');
    } catch {
      // bỏ qua
    }
    setSelectedCase(null);
    setMarketPrice(0);
    reset(getDefaultFormValues(defaultBuffRate, nextOwnershipDefaults));
  }

  const handleCancel = () => {
    try {
      localStorage.removeItem('add_case_dialog_draft');
    } catch {
      // bỏ qua
    }
    setSelectedCase(null);
    setMarketPrice(0);
    reset(getDefaultFormValues(defaultBuffRate, manualOwnershipDefaults));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[95vh] max-w-xl overflow-y-auto rounded-[6px] p-6 shadow-xl">
        <form onSubmit={formSubmit(onFormSubmit)} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl font-bold">
              {t('portfolio.addItem', 'Add item')}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              {t('portfolio.addItemDesc', 'Search item, enter purchase price and quantity.')}
            </DialogDescription>
          </DialogHeader>

          <div
            className={`space-y-5 transition-all duration-350 ${isResetting ? 'animate-reset-flash' : ''}`}
          >
            <CaseSelectionSection
              selectedCase={selectedCase}
              onSelect={(caseItem, price) => {
                setSelectedCase(caseItem);
                setMarketPrice(price);
                const buffPrice = getSavedBuffPriceCny(caseItem.marketHashName, buffPricesCny);
                setValue('buffRate', formatIntegerVi(defaultBuffRate));
                if (buffPrice !== null) {
                  setValue('buffPrice', formatDecimalVi(buffPrice));
                  setValue('buyPrice', formatIntegerVi(Math.round(buffPrice * defaultBuffRate)));
                } else {
                  setValue('buffPrice', '');
                  setValue('buyPrice', price > 0 ? formatIntegerVi(price) : '');
                }
              }}
              onClear={() => {
                setSelectedCase(null);
                setMarketPrice(0);
              }}
            />

            <PricingFormulaSection
              control={control}
              hasBuff={hasBuff}
              marketPrice={formatIntegerVi(marketPrice)}
              handleBuffPriceChange={handleBuffPriceChange}
              handleBuffRateChange={handleBuffRateChange}
              handleBuyPriceChange={handleBuyPriceChange}
            />

            <QuantityDateSection control={control} />

            <LocationSelectionSection
              control={control}
              accountId={accountId}
              accounts={accounts}
              storageUnits={storageUnits}
              handleAccountChange={handleAccountChange}
            />

            <StatusSection control={control} itemState={itemState} />
          </div>

          {/* Footer Action Buttons */}
          <div className="border-border mt-6 flex justify-end gap-2 border-t pt-4">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setIsResetting(true);
                try {
                  localStorage.removeItem('add_case_dialog_draft');
                } catch {
                  // ignore
                }
                setSelectedCase(null);
                setMarketPrice(0);
                reset(getDefaultFormValues(defaultBuffRate, manualOwnershipDefaults));
                setTimeout(() => setIsResetting(false), 400);
              }}
              className="text-muted-foreground hover:text-foreground mr-auto h-9 text-xs"
            >
              {t('portfolio.clearDraft', 'Clear draft')}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={handleCancel}
              className="h-9 px-4 text-xs"
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!canSubmit || saving}
              className="h-9 px-4 text-xs"
            >
              {saving ? t('common.saving', 'Saving...') : t('portfolio.saveCase', 'Save case')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getDefaultFormValues(
  defaultBuffRate: number,
  ownershipDefaults: ManualOwnershipPreferences
): FormValues {
  return {
    quantity: '1',
    buyPrice: '',
    buyDate: formatInputDate(new Date()),
    buffPrice: '',
    buffRate: formatIntegerVi(defaultBuffRate),
    accountId: ownershipDefaults.editAccountId,
    storageUnitId: ownershipDefaults.editStorageUnitId,
    itemState: ownershipDefaults.editState,
    holdDays: ownershipDefaults.editHoldDays,
  };
}
