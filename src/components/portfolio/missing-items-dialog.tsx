"use client";

import { useState, useEffect } from "react";
import { Archive, ArrowRightLeft, Trash2, HelpCircle, PlusCircle, CheckCircle } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AccountChangeDetail = {
  steamId64: string;
  name: string;
  change: number;
  previousQuantity: number;
  currentQuantity: number;
};

export type MissingItem = {
  caseId: string;
  marketHashName: string;
  caseName: string;
  imageUrl: string | null;
  previousQuantity: number;
  currentQuantity: number;
  missingQuantity: number;
  accounts?: AccountChangeDetail[];
};

export type ExtraItem = {
  caseId: string;
  marketHashName: string;
  caseName: string;
  imageUrl: string | null;
  previousQuantity: number;
  currentQuantity: number;
  extraQuantity: number;
  accounts?: AccountChangeDetail[];
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
  extraItems?: ExtraItem[];
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
  {
    value: "deleted",
    label: "Đã xóa",
    icon: Trash2,
    color: "text-red-400",
  },
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
  extraItems = [],
  storageUnits,
  onResolve,
}: MissingItemsDialogProps) {
  const [resolutions, setResolutions] = useState<
    Record<string, { resolution: Resolution; storageUnitId?: string }>
  >({});

  const [activeTab, setActiveTab] = useState<"missing" | "extra">("missing");
  const [submitting, setSubmitting] = useState(false);

  // Reset/Initialize state when dialog opens or items change
  useEffect(() => {
    if (open) {
      const initial: Record<string, { resolution: Resolution; storageUnitId?: string }> = {};
      for (const item of missingItems) {
        initial[item.caseId] = {
          resolution: storageUnits.length > 0 ? "storage_unit" : "unknown",
          storageUnitId: storageUnits[0]?.id,
        };
      }
      setResolutions(initial);
      setActiveTab(missingItems.length > 0 ? "missing" : "extra");
    }
  }, [open, missingItems, storageUnits]);

  if (!open || (missingItems.length === 0 && extraItems.length === 0)) return null;

  const showTabs = missingItems.length > 0 && extraItems.length > 0;

  // Dynamic Title and Description
  let title = "Kết quả quét kho đồ Steam";
  let description = "Phát hiện sự thay đổi về số lượng vật phẩm trong kho đồ.";

  if (!showTabs) {
    if (missingItems.length > 0) {
      title = `Phát hiện ${missingItems.length} loại item biến mất`;
      description = "Các item dưới đây đã giảm số lượng so với lần quét trước. Hãy cho biết chúng đã đi đâu.";
    } else if (extraItems.length > 0) {
      title = `Phát hiện ${extraItems.length} loại item mới / tăng thêm`;
      description = "Các item dưới đây đã tăng số lượng hoặc mới xuất hiện so với lần quét trước. Chúng đã được tự động thêm vào portfolio.";
    }
  } else {
    title = "Cập nhật thay đổi kho đồ";
    description = "Phát hiện cả vật phẩm biến mất và vật phẩm mới/tăng thêm trong kho đồ của bạn.";
  }

  const handleSubmit = async () => {
    if (missingItems.length === 0) {
      onClose();
      return;
    }
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
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-4xl border-stone-800 bg-[#0c0f17]/98 p-8 text-stone-100 shadow-[0_30px_90px_rgba(0,0,0,0.95)] backdrop-blur-3xl sm:rounded-2xl flex max-h-[88vh] flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="mb-4">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold text-stone-100">
            <span className={`inline-flex size-9 items-center justify-center rounded-full ${
              activeTab === "missing" ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"
            }`}>
              {activeTab === "missing" ? (
                <Archive className="size-5" />
              ) : (
                <PlusCircle className="size-5" />
              )}
            </span>
            {title}
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-stone-400 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        {/* Tab switchers if both exist */}
        {showTabs && (
          <div className="flex border-b border-stone-800/80 bg-stone-950/30 mb-5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("missing")}
              className={`border-b-3 px-5 py-3 text-sm font-bold tracking-wider uppercase transition-all cursor-pointer ${
                activeTab === "missing"
                  ? "border-amber-500 text-amber-400"
                  : "border-transparent text-stone-400 hover:text-stone-300"
              }`}
            >
              Biến mất (Thiếu: {missingItems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("extra")}
              className={`border-b-3 px-5 py-3 text-sm font-bold tracking-wider uppercase transition-all cursor-pointer ${
                activeTab === "extra"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-stone-400 hover:text-stone-300"
              }`}
            >
              Mới / Tăng thêm (Thừa: {extraItems.length})
            </button>
          </div>
        )}

        {/* Table Container */}
        <div className="relative flex-grow min-h-[250px] overflow-y-auto rounded-xl border border-stone-850 bg-stone-950/50">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-[#0e1220] text-xs font-bold uppercase tracking-wider text-stone-450 border-b border-stone-850 shadow-sm">
              <tr>
                <th className="py-4 px-6 min-w-[260px]">Vật phẩm</th>
                <th className="py-4 px-6 w-36 text-center">Biến động</th>
                <th className="py-4 px-6 w-[300px]">
                  {activeTab === "missing" ? "Giải pháp" : "Trạng thái"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-900/50">
              {activeTab === "missing" ? (
                missingItems.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-stone-500 text-sm">
                      Không có vật phẩm biến mất
                    </td>
                  </tr>
                ) : (
                  missingItems.map((item) => {
                    const current = resolutions[item.caseId];
                    return (
                      <tr
                        key={item.caseId}
                        className="transition-colors duration-150 hover:bg-stone-900/25"
                      >
                        {/* Item Details */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-4">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.caseName}
                                className="size-12 rounded-lg bg-stone-900 object-contain shrink-0 border border-stone-800/80 shadow-inner"
                              />
                            ) : (
                              <div className="flex size-12 items-center justify-center rounded-lg bg-stone-900 shrink-0 border border-stone-800/80 shadow-inner">
                                <Archive className="size-5 text-stone-600" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-stone-100 leading-tight" title={item.caseName}>
                                {item.caseName}
                              </p>
                              <p className="truncate text-xs text-stone-400 mt-1 font-medium" title={item.marketHashName}>
                                {item.marketHashName}
                              </p>
                              {item.accounts && item.accounts.length > 0 && (
                                <p className="mt-1.5 text-xs text-amber-400 bg-amber-500/5 border border-amber-500/10 rounded px-2 py-0.5 inline-block font-semibold">
                                  Tài khoản: {item.accounts.map(a => `${a.name} (${a.change > 0 ? `+${a.change}` : a.change})`).join(", ")}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Quantity change */}
                        <td className="py-4 px-6 text-center">
                          <span className="text-lg font-black text-red-400">
                            -{item.missingQuantity}
                          </span>
                          <span className="block text-xs text-stone-450 font-mono font-medium mt-1">
                            {item.previousQuantity} → {item.currentQuantity}
                          </span>
                        </td>

                        {/* Resolution drop downs */}
                        <td className="py-4 px-6">
                          <div className="flex flex-col gap-2 max-w-[270px]">
                            <Select
                              value={current?.resolution ?? "unknown"}
                              onValueChange={(val) => {
                                setResolutions((prev) => ({
                                  ...prev,
                                  [item.caseId]: {
                                    resolution: val as Resolution,
                                    storageUnitId:
                                      val === "storage_unit"
                                        ? (prev[item.caseId]?.storageUnitId ?? storageUnits[0]?.id)
                                        : undefined,
                                  },
                                }));
                              }}
                            >
                              <Select.Trigger className="h-10 text-sm font-semibold border-stone-800 bg-stone-950/70 focus:border-accent">
                                <Select.Value />
                              </Select.Trigger>
                              <Select.Content className="border-stone-800 bg-[#0c0f16] text-stone-200">
                                {RESOLUTION_OPTIONS.map((opt) => {
                                  const Icon = opt.icon;
                                  return (
                                    <Select.Item key={opt.value} value={opt.value}>
                                      <div className="flex items-center gap-2.5 py-0.5">
                                        <Icon className={`size-4.5 ${opt.color}`} />
                                        <span className="text-sm font-semibold">{opt.label}</span>
                                      </div>
                                    </Select.Item>
                                  );
                                })}
                              </Select.Content>
                            </Select>

                            {/* Storage unit select, if storage_unit resolution is active */}
                            {current?.resolution === "storage_unit" && (
                              <div className="w-full">
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
                                    <Select.Trigger className="h-10 text-sm font-semibold border-stone-800 bg-stone-900/60 focus:border-accent">
                                      <Select.Value />
                                    </Select.Trigger>
                                    <Select.Content className="border-stone-800 bg-[#0c0f16]">
                                      {storageUnits.map((su) => (
                                        <Select.Item key={su.id} value={su.id}>
                                          <span className="text-sm font-semibold">
                                            {su.name} ({su.currentCount}/1000)
                                          </span>
                                        </Select.Item>
                                      ))}
                                    </Select.Content>
                                  </Select>
                                ) : (
                                  <p className="rounded border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 text-xs text-amber-400/80 leading-normal">
                                    Không tìm thấy Storage Unit nào trong kho.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )
              ) : (
                extraItems.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-stone-500 text-sm">
                      Không có vật phẩm mới hoặc tăng thêm
                    </td>
                  </tr>
                ) : (
                  extraItems.map((item) => (
                    <tr
                      key={item.caseId}
                      className="transition-colors duration-150 hover:bg-stone-900/25"
                    >
                      {/* Item Details */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-4">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.caseName}
                              className="size-12 rounded-lg bg-stone-900 object-contain shrink-0 border border-stone-800/80 shadow-inner"
                            />
                          ) : (
                            <div className="flex size-12 items-center justify-center rounded-lg bg-stone-900 shrink-0 border border-stone-800/80 shadow-inner">
                              <Archive className="size-5 text-stone-600" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-stone-100 leading-tight" title={item.caseName}>
                              {item.caseName}
                            </p>
                            <p className="truncate text-xs text-stone-400 mt-1 font-medium" title={item.marketHashName}>
                              {item.marketHashName}
                            </p>
                            {item.accounts && item.accounts.length > 0 && (
                              <p className="mt-1.5 text-xs text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded px-2 py-0.5 inline-block font-semibold">
                                Tài khoản: {item.accounts.map(a => `${a.name} (${a.change > 0 ? `+${a.change}` : a.change})`).join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Quantity change */}
                      <td className="py-4 px-6 text-center">
                        <span className="text-lg font-black text-emerald-400">
                          +{item.extraQuantity}
                        </span>
                        <span className="block text-xs text-stone-450 font-mono font-medium mt-1">
                          {item.previousQuantity} → {item.currentQuantity}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-950/50 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400 select-none">
                          <CheckCircle className="size-4" />
                          <span>Tự động thêm vào Portfolio</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Area */}
        <div className="mt-5 flex items-center justify-end gap-3 border-t border-stone-900/80 pt-5 shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-10 px-5 text-sm font-semibold border-stone-850 bg-stone-900/60 text-stone-300 hover:border-stone-700 hover:bg-stone-850"
          >
            Bỏ qua
          </Button>
          <Button
            variant="primary"
            disabled={submitting}
            onClick={handleSubmit}
            className="h-10 bg-accent hover:bg-accent-hover text-accent-foreground px-6 text-sm font-bold shadow-md shadow-accent/15 disabled:opacity-45"
          >
            {submitting ? "Đang xử lý..." : "Xác nhận"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
