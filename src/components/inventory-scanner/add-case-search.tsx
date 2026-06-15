"use client";

import React, {
  useCallback,
  useEffect,
  useState,
  useMemo,
} from "react";
import { Plus } from "lucide-react";
import { CaseItemData } from "./types";
import {
  CaseSearchSelect,
  type CaseItemSearchData,
} from "@/components/portfolio";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

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

const formatInputDate = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const AddCaseSearch: React.FC<AddCaseSearchProps> = ({
  onAdd,
  scannedAccounts = [],
  defaultBuffRate = 3600,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Dialog / Form states
  const [selectedCase, setSelectedCase] = useState<CaseItemSearchData | null>(
    null,
  );
  const [quantity, setQuantity] = useState("1");
  const [buyPrice, setBuyPrice] = useState("");
  const [buyDate, setBuyDate] = useState(formatInputDate(new Date()));
  const [buffPrice, setBuffPrice] = useState("");
  const [buffRate, setBuffRate] = useState(String(defaultBuffRate));
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
    setBuffRate(String(defaultBuffRate));
    setSelectedAccountId("");
    setSelectedStorageUnitId("");
    setError(null);
  }, [defaultBuffRate]);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  // Fetch linked accounts from database
  const accountsQuery = useQuery({
    queryKey: ["portfolio-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/portfolio/accounts");
      if (!res.ok) throw new Error("Failed to fetch accounts");
      const data = await res.json();
      return data as Array<{ id: string; steamId64: string; name: string }>;
    },
    enabled: isOpen,
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
    queryKey: ["storage-units", selectedSteamId],
    queryFn: async () => {
      const res = await fetch(
        `/api/portfolio/storage-units?steamId64=${selectedSteamId}`,
      );
      if (!res.ok) throw new Error("Failed to fetch storage units");
      const data = await res.json();
      return data.storageUnits as Array<{
        id: string;
        name: string;
        currentCount: number;
      }>;
    },
    enabled: isOpen && Boolean(selectedSteamId),
  });

  const storageUnits = storageUnitsQuery.data ?? [];

  const handleAccountChange = (val: string) => {
    setSelectedAccountId(val);
    setSelectedStorageUnitId("");
  };

  // Recalculate buyPrice when buffPrice or buffRate changes
  const handleBuffPriceChange = (val: string) => {
    setBuffPrice(val);
    const priceNum = parseFloat(val);
    const rateNum = parseFloat(buffRate);
    if (!isNaN(priceNum) && !isNaN(rateNum)) {
      setBuyPrice(String(Math.round(priceNum * rateNum)));
    } else {
      setBuyPrice("");
    }
  };

  const handleBuffRateChange = (val: string) => {
    setBuffRate(val);
    const priceNum = parseFloat(buffPrice);
    const rateNum = parseFloat(val);
    if (!isNaN(priceNum) && !isNaN(rateNum)) {
      setBuyPrice(String(Math.round(priceNum * rateNum)));
    } else if (!val) {
      setBuyPrice("");
    }
  };

  const canSubmit = useMemo(() => {
    return (
      selectedCase && Number(quantity) > 0 && Number(buyPrice) > 0 && buyDate
    );
  }, [selectedCase, quantity, buyPrice, buyDate]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!selectedCase || !canSubmit) {
      setError("Vui lòng nhập giá mua và số lượng hợp lệ.");
      return;
    }

    const sourceAccounts = selectedAccount
      ? [{ steamId64: selectedAccount.steamId64, name: selectedAccount.name }]
      : undefined;

    const selectedStorageUnit = storageUnits.find(
      (su) => su.id === selectedStorageUnitId,
    );

    onAdd(
      {
        ...selectedCase,
        imageUrl: selectedCase.imageUrl || null,
      },
      Number(buyPrice),
      Number(quantity),
      Number(buyPrice),
      buyDate,
      sourceAccounts,
      selectedStorageUnitId || undefined,
      Number(buffPrice) || undefined,
      Number(buffRate) || undefined,
      selectedStorageUnit?.name || undefined,
    );

    setIsOpen(false);
    resetForm();
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-400 px-4 text-sm font-semibold text-stone-950 shadow-[0_2px_10px_rgba(59,130,246,0.2)] transition-all hover:bg-blue-300"
      >
        <Plus className="size-4" />
        Thêm vật phẩm
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="border-stone-850 max-h-[95vh] max-w-xl overflow-y-auto rounded-[6px] bg-[#06080c]/98 p-6 text-stone-100 shadow-[0_30px_90px_rgba(0,0,0,0.9)] backdrop-blur-3xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-stone-200">
                Thêm vật phẩm
              </DialogTitle>
              <DialogDescription className="text-xs text-stone-400">
                Tìm vật phẩm, nhập giá mua và số lượng.
              </DialogDescription>
            </DialogHeader>

            {/* Case Selection area */}
            <CaseSearchSelect
              selectedCase={selectedCase}
              onSelect={(caseItem, price) => {
                setSelectedCase(caseItem);
                if (price > 0) {
                  setBuyPrice(String(price));
                }
              }}
              onClear={() => setSelectedCase(null)}
              label="Tìm kiếm vật phẩm"
            />

            {selectedCase && (
              <>
                {/* Pricing Formula Row */}
                <div className="space-y-2">
                  <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
                    {/* Buff Price Input */}
                    <div className="min-w-0 flex-1">
                      <label className="mb-1 block text-[10px] font-semibold text-stone-400">
                        Giá Buff (CNY)
                      </label>
                      <Input
                        value={buffPrice}
                        onChange={(e) => handleBuffPriceChange(e.target.value)}
                        placeholder="VD: 3.5"
                        className="h-10 border-stone-800 bg-stone-950 text-sm text-stone-200 placeholder:text-stone-700"
                      />
                    </div>

                    {/* Multiplication Sign */}
                    <div className="hidden items-center justify-center px-1 pb-2.5 text-sm font-black text-stone-600 select-none sm:flex">
                      ×
                    </div>
                    <div className="text-center text-xs font-black text-stone-600 select-none sm:hidden">
                      nhân với (Rate)
                    </div>

                    {/* Exchange Rate Input */}
                    <div className="min-w-0 flex-1">
                      <label className="mb-1 block text-[10px] font-semibold text-stone-400">
                        Tỷ lệ (Rate)
                      </label>
                      <Input
                        value={buffRate}
                        onChange={(e) => handleBuffRateChange(e.target.value)}
                        placeholder="VD: 3600"
                        className="h-10 border-stone-800 bg-stone-950 text-sm text-stone-200 placeholder:text-stone-700"
                      />
                    </div>

                    {/* Equals Sign */}
                    <div className="hidden items-center justify-center px-1 pb-2.5 text-sm font-black text-stone-600 select-none sm:flex">
                      =
                    </div>
                    <div className="text-center text-xs font-black text-stone-600 select-none sm:hidden">
                      bằng (VND)
                    </div>

                    {/* Final Buy Price Input */}
                    <div className="min-w-0 flex-[1.2]">
                      <label className="mb-1 block text-[10px] font-bold text-blue-400">
                        Giá mua / case (VND)
                      </label>
                      <Input
                        value={buyPrice}
                        onChange={(event) => setBuyPrice(event.target.value)}
                        inputMode="numeric"
                        placeholder="VD: 12500"
                        className="h-10 border-stone-800 bg-stone-950 text-sm font-bold text-blue-300 text-stone-200 focus:border-blue-400/80 focus:ring-1 focus:ring-blue-400/30"
                      />
                    </div>
                  </div>
                </div>

                {/* Quantity & Buy Date Side by Side */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-stone-300">
                      Số lượng
                    </label>
                    <Input
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      inputMode="numeric"
                      className="h-10 border-stone-800 bg-stone-950 text-sm text-stone-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-stone-300">
                      Ngày mua
                    </label>
                    <Input
                      type="date"
                      value={buyDate}
                      onChange={(event) => setBuyDate(event.target.value)}
                      className="h-10 border-stone-800 bg-stone-950 text-sm text-stone-200"
                    />
                  </div>
                </div>

                {/* Account & Storage Unit Selection */}
                <div className="grid grid-cols-1 gap-4 border-t border-stone-900/40 pt-4 sm:grid-cols-2">
                  <div>
                    <label
                      className="mb-1.5 block text-xs font-semibold text-stone-300"
                      htmlFor="account-select"
                    >
                      Tài khoản sở hữu
                    </label>
                    <Select
                      value={selectedAccountId || "__manual__"}
                      onValueChange={(val) => handleAccountChange(val === "__manual__" ? "" : val)}
                    >
                      <Select.Trigger id="account-select" className="h-10 border-stone-850 bg-stone-950/80">
                        <Select.Value placeholder="Thủ công (Không chọn tài khoản)" />
                      </Select.Trigger>
                      <Select.Content className="border-stone-850 bg-stone-950">
                        <Select.Item value="__manual__">
                          Thủ công (Không chọn tài khoản)
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
                      className="mb-1.5 block text-xs font-semibold text-stone-300"
                      htmlFor="storage-unit-select"
                    >
                      Lưu trữ ở (Storage Unit)
                    </label>
                    <Select
                      value={selectedStorageUnitId || "__inventory__"}
                      onValueChange={(val) => setSelectedStorageUnitId(val === "__inventory__" ? "" : val)}
                      disabled={!selectedAccountId || storageUnits.length === 0}
                    >
                      <Select.Trigger id="storage-unit-select" className="h-10 border-stone-850 bg-stone-950/80">
                        <Select.Value
                          placeholder={
                            !selectedAccountId
                              ? "Chọn tài khoản sở hữu trước"
                              : storageUnits.length === 0
                                ? "Tài khoản không có Storage Unit nào"
                                : "Hòm đồ thường (Inventory)"
                          }
                        />
                      </Select.Trigger>
                      <Select.Content className="border-stone-850 bg-stone-950">
                        <Select.Item value="__inventory__">
                          Hòm đồ thường (Inventory)
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

            {error && <p className="text-xs text-red-400">{error}</p>}

            {/* Footer Actions */}
            <div className="mt-6 flex justify-end gap-2 border-t border-stone-900 pt-4">
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsOpen(false)}
                className="hover:bg-stone-850 h-9 border-stone-800 bg-stone-900/60 px-4 text-xs text-stone-300 hover:border-stone-700"
              >
                Hủy
              </Button>
              {selectedCase && (
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="h-9 border-0 bg-blue-400 px-4 text-xs font-black text-stone-950 transition-all duration-150 hover:bg-blue-300 disabled:opacity-40"
                >
                  Thêm vào danh sách
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
