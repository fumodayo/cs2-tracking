"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PortfolioImportRow } from "./portfolio-excel";

interface ImportExcelConfirmDialogProps {
  open: boolean;
  fileName: string;
  rows: PortfolioImportRow[];
  existingItems: Array<{ marketHashName: string; quantity: number }>;
  onClose: () => void;
  onConfirm: (confirmedRows: PortfolioImportRow[]) => void;
}

interface ConfirmRowState {
  id: string;
  marketHashName: string;
  quantity: number;
  buyPrice: number;
  buyDate: string;
  note?: string;
  caseId?: string;
  checked: boolean;
}

export function ImportExcelConfirmDialog({
  open,
  fileName,
  rows,
  existingItems,
  onClose,
  onConfirm,
}: ImportExcelConfirmDialogProps) {
  const { t } = useTranslation();
  const [localRows, setLocalRows] = useState<ConfirmRowState[]>([]);
  const masterCheckboxRef = useRef<HTMLInputElement>(null);

  // Initialize local rows state from props
  useEffect(() => {
    if (open && rows.length > 0) {
      const initialized = rows.map((row, idx) => {
        const hashName = row.marketHashName || "";
        const initiallyDuplicate = existingItems.some(
          (item) =>
            item.marketHashName.toLowerCase() === hashName.toLowerCase() &&
            item.quantity === row.quantity
        );
        return {
          id: `${hashName}-${idx}`,
          marketHashName: hashName,
          quantity: row.quantity,
          buyPrice: row.buyPrice,
          buyDate: row.buyDate,
          note: row.note,
          caseId: row.caseId,
          checked: !initiallyDuplicate, // Default to unchecked if duplicate exists
        };
      });
      setLocalRows(initialized);
    } else {
      setLocalRows([]);
    }
  }, [open, rows, existingItems]);

  const checkedCount = useMemo(() => {
    return localRows.filter((r) => r.checked).length;
  }, [localRows]);

  const allChecked = useMemo(() => {
    return localRows.length > 0 && localRows.every((r) => r.checked);
  }, [localRows]);

  const someChecked = useMemo(() => {
    return localRows.length > 0 && !allChecked && localRows.some((r) => r.checked);
  }, [localRows, allChecked]);

  // Handle indeterminate state for header checkbox
  useEffect(() => {
    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.indeterminate = someChecked;
    }
  }, [someChecked]);

  const handleToggleAll = () => {
    const targetState = !allChecked;
    setLocalRows((prev) => prev.map((r) => ({ ...r, checked: targetState })));
  };

  const handleToggleRow = (id: string) => {
    setLocalRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r))
    );
  };

  const handleQuantityChange = (id: string, value: string) => {
    const parsed = parseInt(value, 10);
    const newQty = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    setLocalRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, quantity: newQty } : r))
    );
  };

  const handleBuyPriceChange = (id: string, value: string) => {
    const parsed = parseFloat(value.replace(/[^0-9.]/g, ""));
    const newPrice = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    setLocalRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, buyPrice: newPrice } : r))
    );
  };

  const handleConfirm = () => {
    const confirmed = localRows
      .filter((r) => r.checked)
      .map((r) => ({
        marketHashName: r.marketHashName,
        quantity: r.quantity,
        buyPrice: r.buyPrice,
        buyDate: r.buyDate,
        note: r.note,
        caseId: r.caseId,
      }));
    onConfirm(confirmed);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-4xl border-stone-800 bg-[#0c0f17]/98 p-6 text-stone-100 shadow-[0_30px_90px_rgba(0,0,0,0.95)] backdrop-blur-3xl sm:rounded-xl">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold text-stone-200">
            {t("importExcelConfirm.title", "Xác nhận nhập từ Excel")}
          </DialogTitle>
          <DialogDescription className="text-xs text-stone-400">
            {t(
              "importExcelConfirm.description",
              "Kiểm tra lại danh sách vật phẩm từ file. Bạn có thể chọn/bỏ chọn các vật phẩm để nhập và chỉnh sửa nhanh số lượng hoặc giá mua."
            )}
            <span className="ml-1 font-semibold text-blue-400">({fileName})</span>
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Table Container */}
        <div className="relative max-h-[50vh] min-h-[200px] overflow-y-auto rounded-lg border border-stone-850 bg-stone-950/40">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-[#0e121e] text-xs font-semibold uppercase tracking-wider text-stone-400 border-b border-stone-850 shadow-sm">
              <tr>
                <th className="py-3.5 px-4 w-12 text-center">
                  <input
                    ref={masterCheckboxRef}
                    type="checkbox"
                    checked={allChecked}
                    onChange={handleToggleAll}
                    aria-label="Chọn tất cả vật phẩm"
                    className="size-4 rounded border-stone-800 bg-stone-900 text-accent focus:ring-accent focus:ring-offset-stone-950 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4 min-w-[240px]">
                  {t("importExcelConfirm.itemName", "Tên vật phẩm")}
                </th>
                <th className="py-3.5 px-4 w-32">
                  {t("importExcelConfirm.quantity", "Số lượng")}
                </th>
                <th className="py-3.5 px-4 w-44">
                  {t("importExcelConfirm.buyPrice", "Giá mua (VND)")}
                </th>
                <th className="py-3.5 px-4 w-36 text-center">
                  {t("importExcelConfirm.status", "Trạng thái")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-900">
              {localRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-stone-500">
                    {t("common.noResults", "Không có dữ liệu")}
                  </td>
                </tr>
              ) : (
                localRows.map((item) => {
                  const isDuplicate = existingItems.some(
                    (existing) =>
                      existing.marketHashName.toLowerCase() === item.marketHashName.toLowerCase() &&
                      existing.quantity === item.quantity
                  );

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors duration-150 ${
                        item.checked
                          ? "hover:bg-stone-900/40"
                          : "opacity-45 hover:bg-stone-950/20 bg-stone-950/10"
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => handleToggleRow(item.id)}
                          aria-label={`Chọn vật phẩm ${item.marketHashName}`}
                          className="size-4 rounded border-stone-850 bg-stone-900 text-accent focus:ring-accent focus:ring-offset-stone-950 cursor-pointer"
                        />
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-4 font-medium text-stone-200">
                        <div className="line-clamp-2" title={item.marketHashName}>
                          {item.marketHashName}
                        </div>
                        {item.note && item.note !== "Import từ Excel" && (
                          <span className="mt-0.5 block text-[10px] text-stone-500 font-normal">
                            {item.note}
                          </span>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="py-3.5 px-4">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          disabled={!item.checked}
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          aria-label={`Số lượng cho ${item.marketHashName}`}
                          className="h-8 w-24 border-stone-800 bg-stone-950/60 px-2 py-1 text-center text-sm font-medium focus:border-accent"
                        />
                      </td>

                      {/* Buy Price */}
                      <td className="py-3.5 px-4">
                        <Input
                          type="text"
                          value={item.buyPrice.toLocaleString()}
                          disabled={!item.checked}
                          onChange={(e) => handleBuyPriceChange(item.id, e.target.value)}
                          aria-label={`Giá mua cho ${item.marketHashName}`}
                          className="h-8 w-36 border-stone-800 bg-stone-950/60 px-2 py-1 text-right text-sm font-medium focus:border-accent text-blue-300"
                        />
                      </td>

                      {/* Duplicate Status */}
                      <td className="py-3.5 px-4 text-center">
                        {isDuplicate ? (
                          <div
                            className="inline-flex items-center gap-1 rounded-full border border-amber-950/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 select-none"
                            title={t(
                              "importExcelConfirm.alreadyExistsTooltip",
                              "Vật phẩm này đã tồn tại trong portfolio."
                            )}
                          >
                            <AlertTriangle className="size-3" />
                            <span>{t("importExcelConfirm.alreadyExists", "Đã có")}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 rounded-full border border-emerald-950/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 select-none">
                            <Check className="size-3" />
                            <span>Mới</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Area */}
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-stone-900 pt-4">
          <div className="text-xs text-stone-400 font-medium">
            {t("importExcelConfirm.selectedCount", {
              selected: checkedCount,
              total: localRows.length,
            })}
          </div>

          <div className="flex justify-end gap-2.5">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-9 border-stone-800 bg-stone-900/60 px-4 text-xs font-medium text-stone-300 hover:border-stone-700 hover:bg-stone-850"
            >
              {t("importExcelConfirm.cancelButton", "Hủy bỏ")}
            </Button>
            <Button
              variant="primary"
              disabled={checkedCount === 0}
              onClick={handleConfirm}
              className="h-9 bg-accent hover:bg-accent-hover text-accent-foreground px-5 text-xs font-bold shadow-md shadow-accent/10 disabled:opacity-40"
            >
              {t("importExcelConfirm.confirmButton", "Xác nhận nhập")} ({checkedCount})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
