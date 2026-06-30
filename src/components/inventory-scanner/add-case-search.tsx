"use client";

import React, {
  useCallback,
  useEffect,
  useState,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { CaseItemData } from "./types";
import {
  CaseSearchSelect,
  type CaseItemSearchData,
} from "@/components/portfolio";
import { useQuery } from "@tanstack/react-query";
import {
  STEAM_ACCOUNTS_QUERY_KEY,
  STORAGE_UNITS_QUERY_KEY,
  fetchSteamAccounts,
  fetchAccountStorageUnits,
} from "@/lib/api-client/steam-accounts-api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatInputDate, formatIntegerViInput as formatIntegerVi, formatDecimalViInput as formatDecimalVi, parseViFloat } from "@/utils/format";

type AddCaseSearchProps = {
  onAdd: (
    caseItem: CaseItemData,
    price: number,
    quantity: number,
    buyPrice?: number,
    buyDate?: string,
    sourceAccounts?: Array<{ steamId64: string; name: string }>,
    storageUnitId?: string,
    buffPriceManual?: number,
    buffRateManual?: number,
    storageUnitName?: string,
  ) => void;
  scannedAccounts?: Array<{ steamId64: string; name: string }>;
  defaultBuffRate?: number;
};



export const AddCaseSearch: React.FC<AddCaseSearchProps> = ({
  onAdd,
  scannedAccounts = [],
  defaultBuffRate = 3600,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // Dialog / Form states
  const [selectedCase, setSelectedCase] = useState<CaseItemSearchData | null>(
    null,
  );
  const [quantity, setQuantity] = useState("1");
  const [buyPrice, setBuyPrice] = useState("");
  const [buyDate, setBuyDate] = useState(formatInputDate(new Date()));
  const [buffPrice, setBuffPrice] = useState("");
  const [buffRate, setBuffRate] = useState(formatIntegerVi(defaultBuffRate));
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedStorageUnitId, setSelectedStorageUnitId] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset states
  const resetForm = useCallback(() => {
    setSelectedCase(null);
    setQuantity("1");
    setBuyPrice("");
    setBuyDate(formatInputDate(new Date()));
    setBuffPrice("");
    setBuffRate(formatIntegerVi(defaultBuffRate));
    setSelectedAccountId("");
    setSelectedStorageUnitId("");
    setError(null);
  }, [defaultBuffRate]);

  // Load draft or reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      try {
        const savedDraft = localStorage.getItem("add_case_search_draft");
        if (savedDraft) {
          const draft = JSON.parse(savedDraft);
          setSelectedCase(draft.selectedCase || null);
          setQuantity(draft.quantity ?? "1");
          setBuyPrice(draft.buyPrice ?? "");
          setBuyDate(draft.buyDate ?? formatInputDate(new Date()));
          setBuffPrice(draft.buffPrice ?? "");
          setBuffRate(draft.buffRate ?? formatIntegerVi(defaultBuffRate));
          setSelectedAccountId(draft.selectedAccountId ?? "");
          setSelectedStorageUnitId(draft.selectedStorageUnitId ?? "");
          setError(null);
          return;
        }
      } catch (e) {
        console.error("Failed to load draft from localStorage", e);
      }
      resetForm();
    }
  }, [isOpen, defaultBuffRate, resetForm]);

  // Save state to localStorage as draft
  useEffect(() => {
    if (isOpen) {
      const isDefault =
        !selectedCase &&
        quantity === "1" &&
        !buyPrice &&
        !buffPrice &&
        buffRate === formatIntegerVi(defaultBuffRate) &&
        !selectedAccountId &&
        !selectedStorageUnitId;

      try {
        if (isDefault) {
          localStorage.removeItem("add_case_search_draft");
        } else {
          const draft = {
            selectedCase,
            quantity,
            buyPrice,
            buyDate,
            buffPrice,
            buffRate,
            selectedAccountId,
            selectedStorageUnitId,
          };
          localStorage.setItem("add_case_search_draft", JSON.stringify(draft));
        }
      } catch (e) {
        console.error("Failed to update draft in localStorage", e);
      }
    }
  }, [
    isOpen,
    selectedCase,
    quantity,
    buyPrice,
    buyDate,
    buffPrice,
    buffRate,
    selectedAccountId,
    selectedStorageUnitId,
    defaultBuffRate,
  ]);

  // Fetch linked accounts from database
  const accountsQuery = useQuery({
    queryKey: STEAM_ACCOUNTS_QUERY_KEY,
    queryFn: () => fetchSteamAccounts(),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const dbAccounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);

  // Combine database and scanned accounts uniquely
  const accounts = useMemo(() => {
    const map = new Map<string, { steamId64: string; name: string }>();
    if (scannedAccounts) {
      for (const acc of scannedAccounts) {
        map.set(acc.steamId64, acc);
      }
    }
    for (const acc of dbAccounts) {
      map.set(acc.steamId64, { steamId64: acc.steamId64, name: acc.name });
    }
    return Array.from(map.values());
  }, [scannedAccounts, dbAccounts]);

  const selectedAccount = useMemo(() => {
    return accounts.find((acc) => acc.steamId64 === selectedAccountId);
  }, [accounts, selectedAccountId]);

  const selectedSteamId = selectedAccount?.steamId64 ?? "";

  // Fetch storage units for the selected account
  const storageUnitsQuery = useQuery({
    queryKey: STORAGE_UNITS_QUERY_KEY(selectedSteamId),
    queryFn: () => fetchAccountStorageUnits(selectedSteamId),
    enabled: isOpen && Boolean(selectedSteamId),
    staleTime: 5 * 60 * 1000,
  });

  const storageUnits = storageUnitsQuery.data ?? [];

  const handleAccountChange = (val: string) => {
    setSelectedAccountId(val);
    setSelectedStorageUnitId("");
  };

  // Recalculate buyPrice when buffPrice or buffRate changes
  const handleBuffPriceChange = (val: string) => {
    const formatted = formatDecimalVi(val);
    setBuffPrice(formatted);
    const priceNum = parseViFloat(formatted);
    const rateNum = parseViFloat(buffRate);
    if (!isNaN(priceNum) && !isNaN(rateNum)) {
      setBuyPrice(formatIntegerVi(Math.round(priceNum * rateNum)));
    } else {
      setBuyPrice("");
    }
  };

  const handleBuffRateChange = (val: string) => {
    const formatted = formatIntegerVi(val);
    setBuffRate(formatted);
    const priceNum = parseViFloat(buffPrice);
    const rateNum = parseViFloat(formatted);
    if (!isNaN(priceNum) && !isNaN(rateNum)) {
      setBuyPrice(formatIntegerVi(Math.round(priceNum * rateNum)));
    } else if (!val) {
      setBuyPrice("");
    }
  };

  const recalcBuffPrice = (buyPriceVal: string, rate: string) => {
    const buyPriceNum = parseViFloat(buyPriceVal);
    const rateNum = parseViFloat(rate);
    if (!isNaN(buyPriceNum) && !isNaN(rateNum) && rateNum > 0) {
      setBuffPrice(formatDecimalVi(buyPriceNum / rateNum));
    } else if (!buyPriceVal) {
      setBuffPrice("");
    }
  };

  const handleBuyPriceChange = (val: string) => {
    const formatted = formatIntegerVi(val);
    setBuyPrice(formatted);
    recalcBuffPrice(formatted, buffRate);
  };

  const canSubmit = useMemo(() => {
    return (
      selectedCase &&
      Number(quantity.replace(/\D/g, "")) > 0 &&
      parseViFloat(buyPrice) > 0 &&
      buyDate
    );
  }, [selectedCase, quantity, buyPrice, buyDate]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!selectedCase || !canSubmit) {
      setError(t("inventoryScanner.errInvalidPriceQty"));
      return;
    }

    const sourceAccounts = selectedAccount
      ? [{ steamId64: selectedAccount.steamId64, name: selectedAccount.name }]
      : undefined;

    const selectedStorageUnit = storageUnits.find(
      (su) => su.id === selectedStorageUnitId,
    );

    const parsedBuyPrice = parseViFloat(buyPrice) || 0;
    const parsedQuantity = Number(quantity.replace(/\D/g, "")) || 1;

    onAdd(
      {
        ...selectedCase,
        imageUrl: selectedCase.imageUrl || null,
      },
      parsedBuyPrice,
      parsedQuantity,
      parsedBuyPrice,
      buyDate,
      sourceAccounts,
      selectedStorageUnitId || undefined,
      parseViFloat(buffPrice) || undefined,
      parseViFloat(buffRate) || undefined,
      selectedStorageUnit?.name || undefined,
    );

    try {
      localStorage.removeItem("add_case_search_draft");
    } catch {
      // ignore
    }

    setIsOpen(false);
    resetForm();
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-[0_2px_10px_rgba(59,130,246,0.2)] transition-all hover:bg-accent-hover"
      >
        <Plus className="size-4" />
        {t("inventoryScanner.addItem")}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="border-border max-h-[95vh] max-w-xl overflow-y-auto rounded-[6px] bg-card p-6 text-foreground shadow-xl backdrop-blur-3xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold dark:text-stone-200">
                {t("inventoryScanner.addItem")}
              </DialogTitle>
              <DialogDescription className="text-xs text-stone-500 dark:text-stone-400">
                {t("inventoryScanner.addItemDesc")}
              </DialogDescription>
            </DialogHeader>

            {/* Case Selection area */}
            <CaseSearchSelect
              selectedCase={selectedCase}
              onSelect={(caseItem, price) => {
                setSelectedCase(caseItem);
                if (price > 0) {
                  handleBuyPriceChange(price.toString());
                }
              }}
              onClear={() => setSelectedCase(null)}
              label={t("inventoryScanner.searchItem")}
            />

            {selectedCase && (
              <>
                {/* Pricing Formula Row */}
                <div className="space-y-2">
                  <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
                    {/* Buff Price Input */}
                    <div className="min-w-0 flex-1">
                      <label className="mb-1 block text-[10px] font-semibold text-stone-500 dark:text-stone-400">
                        {t("inventoryScanner.buffPriceCny")}
                      </label>
                      <Input
                        value={buffPrice}
                        onChange={(e) => handleBuffPriceChange(e.target.value)}
                        placeholder={t("inventoryScanner.placeholderBuffPrice")}
                        className="h-10 text-sm"
                      />
                    </div>

                    {/* Multiplication Sign */}
                    <div className="hidden items-center justify-center px-1 pb-2.5 text-sm font-black text-stone-400 dark:text-stone-600 select-none sm:flex">
                      ×
                    </div>
                    <div className="text-center text-xs font-black text-stone-400 dark:text-stone-600 select-none sm:hidden">
                      {t("inventoryScanner.multipliedByRate")}
                    </div>

                    {/* Exchange Rate Input */}
                    <div className="min-w-0 flex-1">
                      <label className="mb-1 block text-[10px] font-semibold text-stone-500 dark:text-stone-400">
                        {t("inventoryScanner.buffRate")}
                      </label>
                      <Input
                        value={buffRate}
                        onChange={(e) => handleBuffRateChange(e.target.value)}
                        placeholder={t("inventoryScanner.placeholderBuffRate")}
                        className="h-10 text-sm"
                      />
                    </div>

                    {/* Equals Sign */}
                    <div className="hidden items-center justify-center px-1 pb-2.5 text-sm font-black text-stone-400 dark:text-stone-600 select-none sm:flex">
                      =
                    </div>
                    <div className="text-center text-xs font-black text-stone-400 dark:text-stone-600 select-none sm:hidden">
                      {t("inventoryScanner.equalsVnd")}
                    </div>

                    {/* Final Buy Price Input */}
                    <div className="min-w-0 flex-[1.2]">
                      <label className="mb-1 block text-[10px] font-bold text-accent">
                        {t("inventoryScanner.buyPricePerCaseVnd")}
                      </label>
                      <Input
                        value={buyPrice}
                        onChange={(event) => handleBuyPriceChange(event.target.value)}
                        inputMode="numeric"
                        placeholder={t("inventoryScanner.placeholderBuyPrice")}
                        className="h-10 text-sm font-bold text-accent focus:border-accent/80 focus:ring-1 focus:ring-accent/30"
                      />
                    </div>
                  </div>
                </div>

                {/* Quantity & Buy Date Side by Side */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-stone-600 dark:text-stone-300">
                      {t("inventoryScanner.quantity")}
                    </label>
                    <Input
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      inputMode="numeric"
                      className="h-10 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-stone-600 dark:text-stone-300">
                      {t("inventoryScanner.buyDate")}
                    </label>
                    <DatePicker
                      value={buyDate}
                      onChange={(val) => setBuyDate(val)}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
                  <div>
                    <label
                      className="mb-1.5 block text-xs font-semibold text-stone-600 dark:text-stone-300"
                      htmlFor="account-select"
                    >
                      {t("inventoryScanner.owningAccount")}
                    </label>
                    <Select
                      value={selectedAccountId || "__manual__"}
                      onValueChange={(val) => handleAccountChange(val === "__manual__" ? "" : val)}
                    >
                      <Select.Trigger id="account-select" className="h-10">
                        <Select.Value placeholder={t("inventoryScanner.manualNoAccount")} />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="__manual__">
                          {t("inventoryScanner.manualNoAccount")}
                        </Select.Item>
                        {accounts.map((acc) => (
                          <Select.Item key={acc.steamId64} value={acc.steamId64}>
                            {acc.name} ({acc.steamId64.substring(0, 4)}...
                            {acc.steamId64.substring(13)})
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>

                  <div>
                    <label
                      className="mb-1.5 block text-xs font-semibold text-stone-600 dark:text-stone-300"
                      htmlFor="storage-unit-select"
                    >
                      {t("inventoryScanner.storedInStorageUnit")}
                    </label>
                    <Select
                      value={selectedStorageUnitId || "__inventory__"}
                      onValueChange={(val) => setSelectedStorageUnitId(val === "__inventory__" ? "" : val)}
                      disabled={!selectedAccountId || storageUnits.length === 0}
                    >
                      <Select.Trigger id="storage-unit-select" className="h-10">
                        <Select.Value
                          placeholder={
                            !selectedAccountId
                              ? t("inventoryScanner.selectAccountFirst")
                              : storageUnits.length === 0
                                ? t("inventoryScanner.noStorageUnits")
                                : t("inventoryScanner.defaultInventory")
                          }
                        />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="__inventory__">
                          {t("inventoryScanner.defaultInventory")}
                        </Select.Item>
                        {storageUnits.map((su) => (
                          <Select.Item key={su.id} value={su.id}>
                            {su.name} ({su.currentCount}/1000)
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

            {/* Footer Actions */}
            <div className="mt-6 flex justify-end gap-2 pt-4">
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem("add_case_search_draft");
                  } catch {
                    // ignore
                  }
                  resetForm();
                }}
                className="h-9 text-xs text-muted-foreground hover:text-foreground mr-auto"
              >
                {t("portfolio.clearDraft", "Clear draft")}
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem("add_case_search_draft");
                  } catch {
                    // ignore
                  }
                  setIsOpen(false);
                  resetForm();
                }}
                className="h-9 px-4 text-xs"
              >
                {t("common.cancel")}
              </Button>
              {selectedCase && (
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  variant="primary"
                  className="h-9 px-4 text-xs"
                >
                  {t("inventoryScanner.addToList")}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
