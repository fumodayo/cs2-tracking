"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMemo, useState, useEffect, useCallback } from "react";
import {
  STEAM_ACCOUNTS_QUERY_KEY,
  STORAGE_UNITS_QUERY_KEY,
  fetchSteamAccounts,
  fetchAccountStorageUnits,
} from "@/lib/api-client/steam-accounts-api";
import { type CaseItemSearchData } from "../case-search-select";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatInputDate,
  formatIntegerViInput as formatIntegerVi,
  formatDecimalViInput as formatDecimalVi,
  parseViFloat,
} from "@/utils/format";
import { calculateTradeHoldUntil } from "@/utils/date";

import { FormValues } from "./add-case-dialog/types";
import { CaseSelectionSection } from "./add-case-dialog/case-selection-section";
import { PricingFormulaSection } from "./add-case-dialog/pricing-formula-section";
import { QuantityDateSection } from "./add-case-dialog/quantity-date-section";
import { LocationSelectionSection } from "./add-case-dialog/location-selection-section";
import { StatusSection } from "./add-case-dialog/status-section";

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
};

export function AddCaseDialog({
  open,
  saving,
  onClose,
  onSubmit,
  defaultBuffRate = 3600,
}: AddCaseDialogProps) {
  const { t } = useTranslation();
  const [selectedCase, setSelectedCase] = useState<CaseItemSearchData | null>(
    null,
  );
  const [isResetting, setIsResetting] = useState(false);

  const form = useForm<FormValues>({
    defaultValues: {
      quantity: "1",
      buyPrice: "",
      buyDate: formatInputDate(new Date()),
      buffPrice: "",
      buffRate: formatIntegerVi(defaultBuffRate),
      accountId: "",
      storageUnitId: "",
      itemState: "tradeable",
      holdDays: "",
    },
  });

  const {
    control,
    setValue,
    handleSubmit: formSubmit,
    reset,
  } = form;

  const accountId = useWatch({ control, name: "accountId" });
  const itemState = useWatch({ control, name: "itemState" });
  const buffPrice = useWatch({ control, name: "buffPrice" });
  const buffRate = useWatch({ control, name: "buffRate" });
  const buyPrice = useWatch({ control, name: "buyPrice" });
  const quantity = useWatch({ control, name: "quantity" });
  const buyDate = useWatch({ control, name: "buyDate" });

  // Fetch linked accounts
  const accountsQuery = useQuery({
    queryKey: STEAM_ACCOUNTS_QUERY_KEY,
    queryFn: () => fetchSteamAccounts(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);

  const selectedAccount = useMemo(() => {
    return accounts.find(
      (acc) => acc.id === accountId || acc.steamId64 === accountId,
    );
  }, [accounts, accountId]);

  const selectedSteamId = selectedAccount?.steamId64 ?? "";

  // Fetch storage units for selected account
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
      Number(quantity.replace(/\D/g, "")) > 0 &&
      parseViFloat(buyPrice) > 0 &&
      buyDate,
    [buyDate, buyPrice, quantity, selectedCase],
  );

  // Load draft or reset state when dialog opens
  useEffect(() => {
    if (open) {
      try {
        const savedDraft = localStorage.getItem("add_case_dialog_draft");
        if (savedDraft) {
          const draft = JSON.parse(savedDraft);
          if (draft.selectedCase) {
            setSelectedCase(draft.selectedCase);
          } else {
            setSelectedCase(null);
          }
          if (draft.formValues) {
            reset(draft.formValues);
            return;
          }
        }
      } catch (e) {
        console.error("Failed to load draft from localStorage", e);
      }

      // Default reset if no draft found
      setSelectedCase(null);
      reset({
        quantity: "1",
        buyPrice: "",
        buyDate: formatInputDate(new Date()),
        buffPrice: "",
        buffRate: formatIntegerVi(defaultBuffRate),
        accountId: "",
        storageUnitId: "",
        itemState: "tradeable",
        holdDays: "",
      });
    }
  }, [open, defaultBuffRate, reset]);

  const watchedValues = useWatch({ control });

  // Save state to localStorage as draft
  useEffect(() => {
    if (open) {
      // Check if values are default/empty to clean up the draft
      const isDefault =
        !selectedCase &&
        watchedValues.quantity === "1" &&
        !watchedValues.buyPrice &&
        !watchedValues.buffPrice &&
        watchedValues.buffRate === formatIntegerVi(defaultBuffRate) &&
        !watchedValues.accountId &&
        !watchedValues.storageUnitId &&
        watchedValues.itemState === "tradeable" &&
        !watchedValues.holdDays;

      try {
        if (isDefault) {
          localStorage.removeItem("add_case_dialog_draft");
        } else {
          const draft = {
            selectedCase,
            formValues: watchedValues,
          };
          localStorage.setItem("add_case_dialog_draft", JSON.stringify(draft));
        }
      } catch (e) {
        console.error("Failed to update draft in localStorage", e);
      }
    }
  }, [open, selectedCase, watchedValues, defaultBuffRate]);

  // Recalculate buyPrice when buffPrice or buffRate changes
  const recalcBuyPrice = useCallback(
    (price: string, rate: string) => {
      const priceNum = parseViFloat(price);
      const rateNum = parseViFloat(rate);
      if (!isNaN(priceNum) && !isNaN(rateNum)) {
        setValue("buyPrice", formatIntegerVi(Math.round(priceNum * rateNum)));
      } else if (!price && !rate) {
        setValue("buyPrice", "");
      }
    },
    [setValue],
  );

  // Recalculate buffPrice when buyPrice or buffRate changes
  const recalcBuffPrice = useCallback(
    (buyPriceVal: string, rate: string) => {
      const buyPriceNum = parseViFloat(buyPriceVal);
      const rateNum = parseViFloat(rate);
      if (!isNaN(buyPriceNum) && !isNaN(rateNum) && rateNum > 0) {
        setValue("buffPrice", formatDecimalVi(buyPriceNum / rateNum));
      } else if (!buyPriceVal) {
        setValue("buffPrice", "");
      }
    },
    [setValue],
  );

  const handleBuffPriceChange = useCallback(
    (val: string) => {
      const formatted = formatDecimalVi(val);
      setValue("buffPrice", formatted);
      recalcBuyPrice(formatted, buffRate);
    },
    [setValue, recalcBuyPrice, buffRate],
  );

  const handleBuffRateChange = useCallback(
    (val: string) => {
      const formatted = formatIntegerVi(val);
      setValue("buffRate", formatted);
      recalcBuyPrice(buffPrice, formatted);
    },
    [setValue, recalcBuyPrice, buffPrice],
  );

  const handleBuyPriceChange = useCallback(
    (val: string) => {
      const formatted = formatIntegerVi(val);
      setValue("buyPrice", formatted);
      recalcBuffPrice(formatted, buffRate);
    },
    [setValue, recalcBuffPrice, buffRate],
  );

  const handleAccountChange = useCallback(
    (val: string) => {
      setValue("accountId", val === "__manual__" ? "" : val);
      setValue("storageUnitId", "");
    },
    [setValue],
  );

  async function onFormSubmit(data: FormValues) {
    if (!selectedCase || !canSubmit) return;

    const accountInfo = selectedAccount
      ? { steamId64: selectedAccount.steamId64, name: selectedAccount.name }
      : { steamId64: "manual", name: t("common.manual", "Manual") };

    const parsedQuantity = Number(data.quantity.replace(/\D/g, "")) || 1;
    const parsedBuyPrice = parseViFloat(data.buyPrice) || 0;

    const breakdown = {
      tradeable: data.itemState === "tradeable" ? parsedQuantity : 0,
      onMarket: 0,
      tradeProtected:
        data.itemState === "protected" ? parsedQuantity : 0,
      hold: data.itemState === "hold" ? parsedQuantity : 0,
      holdDetails:
        data.itemState === "hold"
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
    if (data.itemState === "hold" && data.holdDays) {
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

    try {
      localStorage.removeItem("add_case_dialog_draft");
    } catch {
      // ignore
    }
    setSelectedCase(null);
    reset();
  }

  const handleCancel = () => {
    try {
      localStorage.removeItem("add_case_dialog_draft");
    } catch {
      // ignore
    }
    setSelectedCase(null);
    reset({
      quantity: "1",
      buyPrice: "",
      buyDate: formatInputDate(new Date()),
      buffPrice: "",
      buffRate: String(defaultBuffRate),
      accountId: "",
      storageUnitId: "",
      itemState: "tradeable",
      holdDays: "",
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[95vh] max-w-xl overflow-y-auto rounded-[6px] p-6 shadow-xl">
        <form onSubmit={formSubmit(onFormSubmit)} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              {t("portfolio.addItem", "Add item")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {t("portfolio.addItemDesc", "Search item, enter purchase price and quantity.")}
            </DialogDescription>
          </DialogHeader>

          <div
            className={`space-y-5 transition-all duration-350 ${isResetting ? "animate-reset-flash" : ""}`}
          >
            <CaseSelectionSection
              selectedCase={selectedCase}
              onSelect={(caseItem, price) => {
                setSelectedCase(caseItem);
                if (price > 0) {
                  handleBuyPriceChange(price.toString());
                }
              }}
              onClear={() => setSelectedCase(null)}
            />

            <PricingFormulaSection
              control={control}
              handleBuffPriceChange={handleBuffPriceChange}
              handleBuffRateChange={handleBuffRateChange}
              handleBuyPriceChange={handleBuyPriceChange}
              formatIntegerVi={formatIntegerVi}
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
          <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setIsResetting(true);
                try {
                  localStorage.removeItem("add_case_dialog_draft");
                } catch {
                  // ignore
                }
                setSelectedCase(null);
                reset({
                  quantity: "1",
                  buyPrice: "",
                  buyDate: formatInputDate(new Date()),
                  buffPrice: "",
                  buffRate: String(defaultBuffRate),
                  accountId: "",
                  storageUnitId: "",
                  itemState: "tradeable",
                  holdDays: "",
                });
                setTimeout(() => setIsResetting(false), 400);
              }}
              className="h-9 text-xs text-muted-foreground hover:text-foreground mr-auto"
            >
              {t("portfolio.clearDraft", "Clear draft")}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={handleCancel}
              className="h-9 px-4 text-xs"
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!canSubmit || saving}
              className="h-9 px-4 text-xs"
            >
              {saving ? t("common.saving", "Saving...") : t("portfolio.saveCase", "Save case")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
