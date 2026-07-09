'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PortfolioImportRow } from './portfolio-excel';

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

  // Khởi tạo state dòng local từ props
  useEffect(() => {
    if (open && rows.length > 0) {
      const initialized = rows.map((row, idx) => {
        const hashName = row.marketHashName || '';
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

  // Xử lý trạng thái indeterminate cho checkbox header
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
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r)));
  };

  const handleQuantityChange = (id: string, value: string) => {
    const parsed = parseInt(value, 10);
    const newQty = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, quantity: newQty } : r)));
  };

  const handleBuyPriceChange = (id: string, value: string) => {
    const parsed = parseFloat(value.replace(/[^0-9.]/g, ''));
    const newPrice = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, buyPrice: newPrice } : r)));
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
      <DialogContent className="border-border bg-card text-foreground max-w-4xl border p-6 shadow-[0_30px_90px_rgba(0,0,0,0.25)] backdrop-blur-3xl sm:rounded-xl dark:shadow-[0_30px_90px_rgba(0,0,0,0.95)]">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-foreground text-xl font-bold">
            {t('importExcelConfirm.title', 'Confirm Excel Import')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {t(
              'importExcelConfirm.description',
              'Review the items list from the file. You can select/deselect items to import and quickly edit their quantity or buy price.'
            )}
            <span className="ml-1 font-semibold text-blue-600 dark:text-blue-400">
              ({fileName})
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Table Container */}
        <div className="border-border bg-surface-muted/20 relative max-h-[50vh] min-h-[200px] overflow-y-auto rounded-lg border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-surface-muted/60 text-muted-foreground border-border sticky top-0 z-10 border-b text-xs font-semibold tracking-wider uppercase shadow-sm backdrop-blur-sm dark:bg-[#0e121e]">
              <tr>
                <th className="w-12 px-4 py-3.5 text-center">
                  <input
                    ref={masterCheckboxRef}
                    type="checkbox"
                    checked={allChecked}
                    onChange={handleToggleAll}
                    aria-label={t('importExcelConfirm.selectAllItems', 'Select all items')}
                    className="border-border bg-background text-accent focus:ring-accent focus:ring-offset-card size-4 cursor-pointer rounded"
                  />
                </th>
                <th className="min-w-[240px] px-4 py-3.5">
                  {t('importExcelConfirm.itemName', 'Item Name')}
                </th>
                <th className="w-32 px-4 py-3.5">{t('importExcelConfirm.quantity', 'Quantity')}</th>
                <th className="w-44 px-4 py-3.5">
                  {t('importExcelConfirm.buyPrice', 'Buy Price (VND)')}
                </th>
                <th className="w-36 px-4 py-3.5 text-center">
                  {t('importExcelConfirm.status', 'Status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-border/50 divide-y">
              {localRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted-foreground py-8 text-center">
                    {t('common.noResults', 'No results found.')}
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
                          ? 'hover:bg-surface-muted/30'
                          : 'hover:bg-surface-muted/10 bg-surface-muted/5 opacity-45'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => handleToggleRow(item.id)}
                          aria-label={t('importExcelConfirm.selectItemName', 'Select {{name}}', {
                            name: item.marketHashName,
                          })}
                          className="border-border bg-background text-accent focus:ring-accent focus:ring-offset-card size-4 cursor-pointer rounded"
                        />
                      </td>

                      {/* Name */}
                      <td className="text-foreground px-4 py-3.5 font-medium">
                        <div className="line-clamp-2" title={item.marketHashName}>
                          {item.marketHashName}
                        </div>
                        {item.note && item.note !== 'Import t\u1eeb Excel' && (
                          <span className="text-muted-foreground mt-0.5 block text-[10px] font-normal">
                            {item.note}
                          </span>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="px-4 py-3.5">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          disabled={!item.checked}
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          aria-label={t(
                            'importExcelConfirm.quantityForName',
                            'Quantity for {{name}}',
                            { name: item.marketHashName }
                          )}
                          className="focus:border-accent h-8 w-24 px-2 py-1 text-center text-sm font-medium"
                        />
                      </td>

                      {/* Buy Price */}
                      <td className="px-4 py-3.5">
                        <Input
                          type="text"
                          value={item.buyPrice.toLocaleString()}
                          disabled={!item.checked}
                          onChange={(e) => handleBuyPriceChange(item.id, e.target.value)}
                          aria-label={t(
                            'importExcelConfirm.buyPriceForName',
                            'Buy price for {{name}}',
                            { name: item.marketHashName }
                          )}
                          className="focus:border-accent h-8 w-36 px-2 py-1 text-right text-sm font-medium text-blue-600 dark:text-blue-300"
                        />
                      </td>

                      {/* Duplicate Status */}
                      <td className="px-4 py-3.5 text-center">
                        {isDuplicate ? (
                          <div
                            className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 select-none dark:border-amber-950/40 dark:bg-amber-500/10 dark:text-amber-400"
                            title={t(
                              'importExcelConfirm.alreadyExistsTooltip',
                              'This item already exists in your portfolio.'
                            )}
                          >
                            <AlertTriangle className="size-3" />
                            <span>{t('importExcelConfirm.alreadyExists', 'Exists')}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600 select-none dark:border-emerald-950/40 dark:bg-emerald-500/10 dark:text-emerald-400">
                            <Check className="size-3" />
                            <span>{t('importExcelConfirm.newStatus', 'New')}</span>
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
        <div className="border-border mt-5 flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-muted-foreground text-xs font-medium">
            {t('importExcelConfirm.selectedCount', {
              selected: checkedCount,
              total: localRows.length,
            })}
          </div>

          <div className="flex justify-end gap-2.5">
            <Button variant="outline" onClick={onClose} className="h-9 px-4 text-xs font-medium">
              {t('importExcelConfirm.cancelButton', 'Cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={checkedCount === 0}
              onClick={handleConfirm}
              className="bg-accent hover:bg-accent-hover text-accent-foreground shadow-accent/10 h-9 px-5 text-xs font-bold shadow-md disabled:opacity-40"
            >
              {t('importExcelConfirm.confirmButton', 'Confirm Import')} ({checkedCount})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
