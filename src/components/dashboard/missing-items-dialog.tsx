"use client";

import { useState } from "react";
import { X, Archive, ArrowRightLeft, Trash2, HelpCircle } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
export type MissingItem = {
  caseId: string;
  marketHashName: string;
  caseName: string;
  imageUrl: string | null;
  previousQuantity: number;
  currentQuantity: number;
  missingQuantity: number;
};

export type SyncStorageUnit = {
  id: string;
  name: string;
  steamId64: string;
  currentCount: number;
};

type Resolution = "storage_unit" | "traded" | "deleted" | "unknown";

type ItemResolution = {
  caseId: string;
  marketHashName: string;
  missingQuantity: number;
  resolution: Resolution;
  storageUnitId?: string;
};

type MissingItemsDialogProps = {
  open: boolean;
  onClose: () => void;
  missingItems: MissingItem[];
  storageUnits: SyncStorageUnit[];
  onResolve: (resolutions: ItemResolution[]) => Promise<void>;
};

const RESOLUTION_OPTIONS: Array<{
  value: Resolution;
  label: string;
  icon: typeof Archive;
  color: string;
}> = [
    {
      value: "storage_unit",
      label: "Cất vào Storage Unit",
      icon: Archive,
      color: "text-amber-400",
    },
    {
      value: "traded",
      label: "Đã trade",
      icon: ArrowRightLeft,
      color: "text-blue-400",
    },
    { value: "deleted", label: "Đã xóa", icon: Trash2, color: "text-red-400" },
    {
      value: "unknown",
      label: "Không biết",
      icon: HelpCircle,
      color: "text-stone-400",
    },
  ];

export function MissingItemsDialog({
  open,
  onClose,
  missingItems,
  storageUnits,
  onResolve,
}: MissingItemsDialogProps) {
  const [resolutions, setResolutions] = useState<
    Record<string, { resolution: Resolution; storageUnitId?: string }>
  >(() => {
    const initial: Record<
      string,
      { resolution: Resolution; storageUnitId?: string }
    > = {};
    for (const item of missingItems) {
      initial[item.caseId] = {
        resolution: storageUnits.length > 0 ? "storage_unit" : "unknown",
        storageUnitId: storageUnits[0]?.id,
      };
    }
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);

  if (!open || missingItems.length === 0) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload: ItemResolution[] = missingItems.map((item) => {
        const r = resolutions[item.caseId];
        return {
          caseId: item.caseId,
          marketHashName: item.marketHashName,
          missingQuantity: item.missingQuantity,
          resolution: r?.resolution ?? "unknown",
          storageUnitId:
            r?.resolution === "storage_unit" ? r.storageUnitId : undefined,
        };
      });
      await onResolve(payload);
      onClose();
    } catch (err) {
      console.error("Failed to resolve missing items:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-stone-700 bg-stone-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-100">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                <Archive className="size-4" />
              </span>
              Phát hiện {missingItems.length} loại item biến mất
            </h2>
            <p className="mt-1 text-xs text-stone-400">
              Các item dưới đây đã giảm số lượng so với lần quét trước. Hãy cho
              biết chúng đã đi đâu.
            </p>
          </div>
          <Button
            type="button"
            onClick={onClose}
            className="cursor-pointer p-1 text-stone-400 transition-colors hover:text-stone-200"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {missingItems.map((item) => {
            const current = resolutions[item.caseId];
            return (
              <div
                key={item.caseId}
                className="rounded-lg border border-stone-800 bg-stone-950/50 p-4"
              >
                {/* Item info */}
                <div className="mb-3 flex items-center gap-3">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.caseName}
                      className="size-10 rounded-md bg-stone-800 object-contain"
                    />
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-md bg-stone-800">
                      <Archive className="size-4 text-stone-500" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-200">
                      {item.caseName}
                    </p>
                    <p className="text-[11px] text-stone-500">
                      {item.marketHashName}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-red-400">
                      -{item.missingQuantity}
                    </p>
                    <p className="text-[10px] text-stone-500">
                      {item.previousQuantity} → {item.currentQuantity}
                    </p>
                  </div>
                </div>

                {/* Resolution options */}
                <div className="grid grid-cols-2 gap-2">
                  {RESOLUTION_OPTIONS.map((option) => {
                    const isSelected = current?.resolution === option.value;
                    const Icon = option.icon;
                    return (
                      <Button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setResolutions((prev) => ({
                            ...prev,
                            [item.caseId]: {
                              resolution: option.value,
                              storageUnitId:
                                option.value === "storage_unit"
                                  ? (prev[item.caseId]?.storageUnitId ??
                                    storageUnits[0]?.id)
                                  : undefined,
                            },
                          }));
                        }}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-all ${isSelected
                            ? "border-blue-500/40 bg-blue-500/10 text-blue-200"
                            : "border-stone-800 bg-stone-900/50 text-stone-400 hover:border-stone-700 hover:text-stone-300"
                          }`}
                      >
                        <Icon
                          className={`size-3.5 ${isSelected ? option.color : "text-stone-500"}`}
                        />
                        {option.label}
                      </Button>
                    );
                  })}
                </div>

                {/* Storage Unit select */}
                {current?.resolution === "storage_unit" && (
                  <div className="mt-3">
                    {storageUnits.length > 0 ? (
                      <Select
                        value={current.storageUnitId ?? ""}
                        onValueChange={(val) => {
                          setResolutions((prev) => ({
                            ...prev,
                            [item.caseId]: {
                              ...prev[item.caseId],
                              storageUnitId: val,
                            },
                          }));
                        }}
                      >
                        <Select.Trigger className="h-8 border-stone-700 bg-stone-900/60 focus:border-amber-500/50">
                          <Select.Value />
                        </Select.Trigger>
                        <Select.Content className="border-stone-800 bg-stone-950">
                          {storageUnits.map((su) => (
                            <Select.Item key={su.id} value={su.id}>
                              {su.name} ({su.currentCount}/1000)
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    ) : (
                      <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-400/80">
                        Không tìm thấy Storage Unit nào trong inventory. Hãy đảm
                        bảo tài khoản có Storage Unit và đã scan với cookie.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-stone-800 px-6 py-4">
          <Button
            type="button"
            onClick={onClose}
            className="h-9 cursor-pointer rounded-md border border-stone-700 bg-stone-900 px-4 text-sm font-medium text-stone-300 transition-colors hover:bg-stone-800"
          >
            Bỏ qua
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="h-9 cursor-pointer rounded-md bg-blue-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-400 disabled:cursor-wait disabled:opacity-50"
          >
            {submitting ? "Đang xử lý..." : "Xác nhận"}
          </Button>
        </div>
      </div>
    </div>
  );
}
