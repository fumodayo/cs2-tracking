"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useCallback } from "react";
import {
  CaseSearchSelect,
  type CaseItemSearchData,
} from "@/components/portfolio";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatInputDate } from "@/utils/format";

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

type FormValues = {
  quantity: string;
  buyPrice: string;
  buyDate: string;
  buffPrice: string;
  buffRate: string;
  accountId: string;
  storageUnitId: string;
  itemState: "tradeable" | "hold" | "protected";
  holdDays: string;
};

export function AddCaseDialog({
  open,
  saving,
  onClose,
  onSubmit,
  defaultBuffRate = 3600,
}: AddCaseDialogProps) {
  const [selectedCase, setSelectedCase] = useState<CaseItemSearchData | null>(
    null,
  );

  const form = useForm<FormValues>({
    defaultValues: {
      quantity: "1",
      buyPrice: "",
      buyDate: formatInputDate(new Date()),
      buffPrice: "",
      buffRate: String(defaultBuffRate),
      accountId: "",
      storageUnitId: "",
      itemState: "tradeable",
      holdDays: "",
    },
  });

  const {
    control,
    watch,
    setValue,
    handleSubmit: formSubmit,
    reset,
  } = form;

  const accountId = watch("accountId");
  const itemState = watch("itemState");
  const buffPrice = watch("buffPrice");
  const buffRate = watch("buffRate");
  const buyPrice = watch("buyPrice");
  const quantity = watch("quantity");
  const buyDate = watch("buyDate");

  // Fetch linked accounts
  const accountsQuery = useQuery({
    queryKey: ["portfolio-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/portfolio/accounts");
      if (!res.ok) throw new Error("Failed to fetch accounts");
      const data = await res.json();
      return data as Array<{ id: string; steamId64: string; name: string }>;
    },
    enabled: open,
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
    enabled: open && Boolean(selectedSteamId),
  });

  const storageUnits = storageUnitsQuery.data ?? [];

  const canSubmit = useMemo(
    () =>
      selectedCase && Number(quantity) > 0 && Number(buyPrice) > 0 && buyDate,
    [buyDate, buyPrice, quantity, selectedCase],
  );

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
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
    }
  }, [open, defaultBuffRate, reset]);

  // Recalculate buyPrice when buffPrice or buffRate changes
  const recalcBuyPrice = useCallback(
    (price: string, rate: string) => {
      const priceNum = parseFloat(price);
      const rateNum = parseFloat(rate);
      if (!isNaN(priceNum) && !isNaN(rateNum)) {
        setValue("buyPrice", String(Math.round(priceNum * rateNum)));
      } else if (!price && !rate) {
        setValue("buyPrice", "");
      }
    },
    [setValue],
  );

  const handleBuffPriceChange = useCallback(
    (val: string) => {
      setValue("buffPrice", val);
      recalcBuyPrice(val, buffRate);
    },
    [setValue, recalcBuyPrice, buffRate],
  );

  const handleBuffRateChange = useCallback(
    (val: string) => {
      setValue("buffRate", val);
      recalcBuyPrice(buffPrice, val);
    },
    [setValue, recalcBuyPrice, buffPrice],
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
      : { steamId64: "manual", name: "Thủ công" };

    const breakdown = {
      tradeable: data.itemState === "tradeable" ? Number(data.quantity) : 0,
      onMarket: 0,
      tradeProtected:
        data.itemState === "protected" ? Number(data.quantity) : 0,
      hold: data.itemState === "hold" ? Number(data.quantity) : 0,
      holdDetails:
        data.itemState === "hold"
          ? [
              {
                quantity: Number(data.quantity),
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
        const holdDate = new Date();
        holdDate.setDate(holdDate.getDate() + days);
        tradeHoldUntil = holdDate.toISOString();
      }
    }

    await onSubmit({
      caseId: selectedCase.id,
      quantity: Number(data.quantity),
      buyPrice: Number(data.buyPrice),
      buyDate: data.buyDate,
      sourceAccounts,
      storageUnitId: data.storageUnitId || undefined,
      tradeHoldUntil,
    });

    setSelectedCase(null);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="border-stone-850 max-h-[95vh] max-w-xl overflow-y-auto rounded-[6px] bg-[#06080c]/98 p-6 text-stone-100 shadow-[0_30px_90px_rgba(0,0,0,0.9)] backdrop-blur-3xl">
        <form onSubmit={formSubmit(onFormSubmit)} className="space-y-5">
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
                setValue("buyPrice", String(price));
              }
            }}
            onClear={() => setSelectedCase(null)}
            label="Tên case"
          />

          {/* Pricing Formula Row: Buff Price x Rate = Buy Price (All side by side in one row) */}
          <div className="space-y-2">
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
              {/* Buff Price Input */}
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-[10px] font-semibold text-stone-400">
                  Giá Buff (CNY)
                </label>
                <Controller
                  control={control}
                  name="buffPrice"
                  render={({ field }) => (
                    <Input
                      value={field.value}
                      onChange={(e) => handleBuffPriceChange(e.target.value)}
                      placeholder="VD: 3.5"
                      className="h-10 border-stone-800 bg-stone-950 text-sm text-stone-200 placeholder:text-stone-700"
                    />
                  )}
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
                <Controller
                  control={control}
                  name="buffRate"
                  render={({ field }) => (
                    <Input
                      value={field.value}
                      onChange={(e) => handleBuffRateChange(e.target.value)}
                      placeholder="VD: 3600"
                      className="h-10 border-stone-800 bg-stone-950 text-sm text-stone-200 placeholder:text-stone-700"
                    />
                  )}
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
                <Controller
                  control={control}
                  name="buyPrice"
                  render={({ field }) => (
                    <Input
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      inputMode="numeric"
                      placeholder="VD: 12500"
                      className="h-10 border-stone-800 bg-stone-950 text-sm font-bold text-blue-300 text-stone-200 focus:border-blue-400/80 focus:ring-1 focus:ring-blue-400/30"
                    />
                  )}
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
              <Controller
                control={control}
                name="quantity"
                render={({ field }) => (
                  <Input
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    inputMode="numeric"
                    className="h-10 border-stone-800 bg-stone-950 text-sm text-stone-200"
                  />
                )}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-stone-300">
                Ngày mua
              </label>
              <Controller
                control={control}
                name="buyDate"
                render={({ field }) => (
                  <Input
                    type="date"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="h-10 border-stone-800 bg-stone-950 text-sm text-stone-200"
                  />
                )}
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
                value={accountId || "__manual__"}
                onValueChange={handleAccountChange}
              >
                <SelectTrigger id="account-select" className="h-10">
                  <SelectValue placeholder="Thủ công (Không chọn tài khoản)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual__">
                    Thủ công (Không chọn tài khoản)
                  </SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} ({acc.steamId64.substring(0, 4)}...
                      {acc.steamId64.substring(13)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label
                className="mb-1.5 block text-xs font-semibold text-stone-300"
                htmlFor="storage-unit-select"
              >
                Lưu trữ ở (Storage Unit)
              </label>
              <Controller
                control={control}
                name="storageUnitId"
                render={({ field }) => (
                  <Select
                    value={field.value || "__inventory__"}
                    onValueChange={(val) =>
                      field.onChange(val === "__inventory__" ? "" : val)
                    }
                    disabled={!accountId || storageUnits.length === 0}
                  >
                    <SelectTrigger id="storage-unit-select" className="h-10">
                      <SelectValue
                        placeholder={
                          !accountId
                            ? "Chọn tài khoản sở hữu trước"
                            : storageUnits.length === 0
                              ? "Tài khoản không có Storage Unit nào"
                              : "Hòm đồ thường (Inventory)"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__inventory__">
                        Hòm đồ thường (Inventory)
                      </SelectItem>
                      {storageUnits.map((su) => (
                        <SelectItem key={su.id} value={su.id}>
                          {su.name} ({su.currentCount}/1000)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Item Status Selection */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold text-stone-300"
                htmlFor="status-select"
              >
                Trạng thái vật phẩm
              </label>
              <Controller
                control={control}
                name="itemState"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => field.onChange(val)}
                  >
                    <SelectTrigger id="status-select" className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tradeable">Trade được ngay</SelectItem>
                      <SelectItem value="hold">Hold trade</SelectItem>
                      <SelectItem value="protected">Trade Protected</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {itemState === "hold" || itemState === "protected" ? (
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold text-stone-300"
                  htmlFor="hold-days-input"
                >
                  Số ngày hold còn lại
                </label>
                <Controller
                  control={control}
                  name="holdDays"
                  render={({ field }) => (
                    <Input
                      id="hold-days-input"
                      type="number"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="Ví dụ: 7"
                      className="h-10 border-stone-800 bg-stone-950 text-sm text-stone-200"
                    />
                  )}
                />
              </div>
            ) : (
              <div className="hidden sm:block" />
            )}
          </div>

          {/* Footer Action Buttons */}
          <div className="mt-6 flex justify-end gap-2 border-t border-stone-900 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="hover:bg-stone-850 h-9 border-stone-800 bg-stone-900/60 px-4 text-xs text-stone-300 hover:border-stone-700"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit || saving}
              className="h-9 border-0 bg-blue-400 px-4 text-xs font-black text-stone-950 transition-all duration-150 hover:bg-blue-300 disabled:opacity-40"
            >
              {saving ? "Đang lưu..." : "Lưu case"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
