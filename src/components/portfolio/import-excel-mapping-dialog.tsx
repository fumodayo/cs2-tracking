'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FaFileExcel,
  FaGripVertical,
  FaCheck,
  FaTrash,
  FaInfo,
  FaArrowRight,
  FaXmark,
} from 'react-icons/fa6';
import { LayoutTemplate } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { cn } from '@/utils/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  type ColumnMapping,
  type MappingTemplate,
  type PortfolioImportRow,
  parseMatrixWithMapping,
} from './portfolio-excel';

interface ImportExcelMappingDialogProps {
  open: boolean;
  fileName: string;
  excelHeaders: string[];
  matrix: unknown[][];
  headerRowIndex: number;
  suggestedMapping: Partial<ColumnMapping>;
  savedTemplates: MappingTemplate[];
  onClose: () => void;
  onConfirm: (mapping: ColumnMapping, saveAsTemplate: boolean, templateLabel: string) => void;
  onDeleteTemplate?: (id: string) => void;
}

function getExcelColumnLetter(colIndex: number): string {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export function ImportExcelMappingDialog({
  open,
  fileName,
  excelHeaders,
  matrix,
  headerRowIndex,
  suggestedMapping,
  savedTemplates,
  onClose,
  onConfirm,
  onDeleteTemplate,
}: ImportExcelMappingDialogProps) {
  const { t } = useTranslation();

  // Trạng thái ánh xạ: key -> index tiêu đề
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateLabel, setTemplateLabel] = useState('');
  const [draggedHeaderIndex, setDraggedHeaderIndex] = useState<number | null>(null);
  const [hoveredTarget, setHoveredTarget] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<PortfolioImportRow[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Định nghĩa các trường hệ thống đích
  const systemFields = useMemo(
    () => [
      {
        key: 'name',
        label: t('excelMapping.fieldName', 'Item Name'),
        required: true,
        defaultValue: '',
      },
      {
        key: 'quantity',
        label: t('excelMapping.fieldQuantity', 'Quantity'),
        required: false,
        defaultValue: '1',
      },
      {
        key: 'buyPrice',
        label: t('excelMapping.fieldBuyPrice', 'Buy Price'),
        required: false,
        defaultValue: '0',
      },
      {
        key: 'buyDate',
        label: t('excelMapping.fieldBuyDate', 'Buy Date'),
        required: false,
        defaultValue: t('excelMapping.defaultValueToday', 'Today'),
      },
      {
        key: 'note',
        label: t('excelMapping.fieldNote', 'Note'),
        required: false,
        defaultValue: '"Import t\u1eeb Excel"',
      },
      {
        key: 'caseId',
        label: t('excelMapping.fieldCaseId', 'Case ID'),
        required: false,
        defaultValue: t('excelMapping.defaultValueEmpty', 'empty'),
      },
    ],
    [t]
  );

  // Dấu vân tay của tiêu đề hiện tại để tự khớp mẫu
  const headerFingerprint = useMemo(() => {
    return JSON.stringify([...excelHeaders].sort());
  }, [excelHeaders]);

  // Nạp mapping template
  const loadTemplate = (template: MappingTemplate) => {
    const newMapping: Partial<ColumnMapping> = {};
    const keys: (keyof ColumnMapping)[] = [
      'name',
      'quantity',
      'buyPrice',
      'buyDate',
      'note',
      'caseId',
    ];
    keys.forEach((key) => {
      if (template.mapping[key] !== undefined && template.mapping[key]! < excelHeaders.length) {
        newMapping[key] = template.mapping[key];
      }
    });
    setMapping(newMapping);
  };

  // Khởi tạo mapping bằng template gợi ý hoặc template khớp
  useEffect(() => {
    if (open) {
      // Kiểm tra có mẫu đã lưu khớp dấu vân tay tiêu đề không
      const autoMatch = savedTemplates.find((tpl) => tpl.headerFingerprint === headerFingerprint);
      if (autoMatch) {
        loadTemplate(autoMatch);
        setSelectedTemplateId(autoMatch.id);
      } else {
        setMapping(suggestedMapping);
        setSelectedTemplateId('');
      }
      setSaveAsTemplate(false);
      setTemplateLabel('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, suggestedMapping, savedTemplates, headerFingerprint]);

  // Cập nhật bảng xem trước khi ánh xạ thay đổi
  useEffect(() => {
    if (mapping.name === undefined) {
      setPreviewRows([]);
      return;
    }

    try {
      const rows = parseMatrixWithMapping(matrix, mapping as ColumnMapping, headerRowIndex);
      setPreviewRows(rows.slice(0, 3));
    } catch (err) {
      console.error('Preview error:', err);
      setPreviewRows([]);
    }
  }, [mapping, matrix, headerRowIndex]);

  const handleFieldChange = (key: string, headerIndexVal: string) => {
    const index =
      headerIndexVal === '' || headerIndexVal === 'none' ? undefined : parseInt(headerIndexVal, 10);
    setMapping((prev) => {
      const next = { ...prev };
      const typedKey = key as keyof ColumnMapping;
      if (index === undefined) {
        delete next[typedKey];
      } else {
        next[typedKey] = index;
      }
      return next;
    });
  };

  const handleFieldClear = (key: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      delete next[key as keyof ColumnMapping];
      return next;
    });
  };

  const handleTemplateSelect = (id: string) => {
    setSelectedTemplateId(id);
    if (!id) {
      setMapping(suggestedMapping);
      return;
    }
    const template = savedTemplates.find((tpl) => tpl.id === id);
    if (template) {
      loadTemplate(template);
    }
  };

  // Handler kéo thả
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedHeaderIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedHeaderIndex(null);
    setHoveredTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    setHoveredTarget(targetKey);
  };

  const handleDragLeave = () => {
    setHoveredTarget(null);
  };

  const handleDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    setHoveredTarget(null);
    if (draggedHeaderIndex !== null) {
      setMapping((prev) => ({
        ...prev,
        [targetKey]: draggedHeaderIndex,
      }));
    }
  };

  const handleConfirmClick = () => {
    if (mapping.name === undefined) return;
    onConfirm(mapping as ColumnMapping, saveAsTemplate, templateLabel);
  };

  const isConfirmedDisabled = mapping.name === undefined;

  // Tìm xem index tiêu đề hiện có ánh xạ vào trường hệ thống nào không
  const getMappedField = (index: number) => {
    const match = Object.entries(mapping).find(([, val]) => val === index);
    return match ? match[0] : null;
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="border-border bg-card text-foreground max-h-[92vh] w-[95vw] max-w-4xl overflow-y-auto rounded-xl border p-4 shadow-[0_30px_90px_rgba(0,0,0,0.25)] backdrop-blur-3xl sm:rounded-xl sm:p-6 md:w-full dark:shadow-[0_30px_90px_rgba(0,0,0,0.95)]"
      >
        <DialogHeader className="mb-4">
          <DialogTitle className="text-foreground text-xl font-bold">
            {t('excelMapping.title', 'Excel Column Mapping')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            <span className="hidden md:inline">
              {t(
                'excelMapping.description',
                'Drag Excel columns from the left and drop them into the corresponding system fields on the right, or select them from the dropdown.'
              )}
            </span>
            <span className="inline md:hidden">
              {t(
                'excelMapping.descriptionMobile',
                'Select the corresponding Excel columns for each system field from the dropdowns below.'
              )}
            </span>
            <span className="ml-1 font-semibold text-blue-600 dark:text-blue-400">
              ({fileName})
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Chọn template */}
        {savedTemplates.length > 0 && (
          <div className="border-border bg-surface-muted/30 mb-4 flex flex-col justify-between gap-2.5 rounded-lg border p-3 sm:flex-row sm:items-center sm:px-4 sm:py-2.5">
            <span className="text-muted-foreground text-xs font-medium">
              {t('excelMapping.selectTemplate', 'Select saved template:')}
            </span>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Select
                value={selectedTemplateId || 'none'}
                onValueChange={(val) => handleTemplateSelect(val === 'none' ? '' : val)}
              >
                <Select.Trigger className="h-8 w-full sm:w-[200px]">
                  <Select.Value
                    placeholder={t('excelMapping.defaultSuggestion', '— Default suggestion —')}
                  />
                </Select.Trigger>
                <Select.Content className="z-[250]">
                  <Select.Item value="none">
                    {t('excelMapping.defaultSuggestion', '— Default suggestion —')}
                  </Select.Item>
                  {savedTemplates.map((tpl) => (
                    <Select.Item key={tpl.id} value={tpl.id}>
                      {tpl.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
              {selectedTemplateId && onDeleteTemplate && (
                <Button
                  variant="outline"
                  onClick={() => {
                    onDeleteTemplate(selectedTemplateId);
                    setSelectedTemplateId('');
                  }}
                  className="border-border text-muted-foreground h-8 w-8 shrink-0 p-0 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  title={t('excelMapping.deleteTemplateTooltip', 'Delete this template')}
                >
                  <FaTrash className="size-3" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Lưới chính: cột Excel bên trái, trường hệ thống bên phải */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
          {/* Bên trái: cột Excel - ẩn trên mobile vì kéo thả chưa hỗ trợ tốt trên màn hình cảm ứng */}
          <div className="hidden flex-col md:col-span-2 md:flex">
            <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
              {t('excelMapping.excelColumns', 'Excel Columns')}
            </h3>
            <div className="border-border bg-surface-muted/20 max-h-[320px] flex-1 space-y-2 overflow-y-auto rounded-lg border p-3 sm:max-h-[400px]">
              {excelHeaders.map((header, idx) => {
                const mappedTo = getMappedField(idx);
                return (
                  <div
                    key={idx}
                    draggable={!mappedTo}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`group flex items-center justify-between rounded-md border px-3 py-2.5 text-xs font-medium shadow-sm transition-all ${
                      mappedTo
                        ? 'border-border/60 bg-surface-muted/15 text-muted-foreground/50 cursor-not-allowed line-through opacity-50 select-none dark:bg-stone-950/20'
                        : 'border-border bg-background hover:bg-surface-hover text-foreground cursor-grab hover:border-stone-300 active:cursor-grabbing dark:hover:border-stone-700'
                    }`}
                  >
                    <div className="mr-1 flex items-center gap-2 overflow-hidden">
                      <FaGripVertical
                        className={`size-3 shrink-0 ${mappedTo ? 'text-stone-400/20 dark:text-stone-500/20' : 'cursor-grab text-stone-400 dark:text-stone-500'}`}
                      />
                      <FaFileExcel
                        className={`size-3.5 shrink-0 ${mappedTo ? 'text-muted-foreground/30' : 'text-emerald-500 dark:text-emerald-400'}`}
                      />
                      <span
                        className={cn(
                          'truncate',
                          !header && 'text-muted-foreground/60 font-normal italic'
                        )}
                      >
                        {header ||
                          t('excelMapping.unnamedColumn', {
                            letter: getExcelColumnLetter(idx),
                            defaultValue: 'Column {{letter}} (Unnamed)',
                          })}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold select-none ${
                        mappedTo
                          ? 'text-muted-foreground/30 bg-surface-muted/10 border-border/30'
                          : 'text-muted-foreground bg-surface-muted/40 border-border/60'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side: System Fields Target Slots */}
          <div className="flex w-full max-w-sm flex-col sm:max-w-none md:col-span-3">
            <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
              {t('excelMapping.systemFields', 'System Fields')}
            </h3>
            <div className="border-border bg-surface-muted/20 max-h-[320px] flex-1 space-y-2.5 overflow-y-auto rounded-lg border p-3 sm:max-h-[400px]">
              {systemFields.map((field) => {
                const currentMappedIdx = mapping[field.key as keyof ColumnMapping];
                const isHovered = hoveredTarget === field.key;

                return (
                  <div
                    key={field.key}
                    onDragOver={(e) => handleDragOver(e, field.key)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, field.key)}
                    className={`relative flex flex-col gap-2 rounded-lg border p-3 transition-all duration-150 ${
                      isHovered
                        ? 'border-accent bg-accent/5 ring-accent ring-1'
                        : currentMappedIdx !== undefined
                          ? 'border-border bg-background shadow-sm'
                          : 'border-border/80 bg-surface-muted/10 border-dashed'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-foreground text-xs font-semibold">{field.label}</span>
                      {field.required ? (
                        <span className="text-[9px] font-bold text-red-500 uppercase select-none dark:text-red-400">
                          *{t('excelMapping.required', 'Required')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[9px] font-normal select-none">
                          {t('excelMapping.defaultValue', { value: field.defaultValue })}
                        </span>
                      )}

                      {currentMappedIdx !== undefined && (
                        <div className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 select-none dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                          <FaCheck className="size-2 shrink-0" />
                          <span>{t('excelMapping.mappedStatus', 'Đã khớp')}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value={
                          currentMappedIdx === undefined ? 'none' : currentMappedIdx.toString()
                        }
                        onValueChange={(val) => handleFieldChange(field.key, val)}
                      >
                        <Select.Trigger className="h-9 w-full">
                          <Select.Value />
                        </Select.Trigger>
                        <Select.Content className="z-[250]">
                          <Select.Item value="none">
                            {t('excelMapping.notMapped', '— Not mapped —')}
                          </Select.Item>
                          {excelHeaders.map((header, idx) => (
                            <Select.Item key={idx} value={idx.toString()}>
                              {header ||
                                t('excelMapping.unnamedColumn', {
                                  letter: getExcelColumnLetter(idx),
                                  defaultValue: 'Column {{letter}} (Unnamed)',
                                })}{' '}
                              (#{idx + 1})
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                      {currentMappedIdx !== undefined && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleFieldClear(field.key)}
                          className="border-border text-muted-foreground hover:bg-surface-hover h-9 w-9 shrink-0 p-0"
                          title={t('excelMapping.clearMappingTooltip', 'Bỏ liên kết cột này')}
                          aria-label={t('excelMapping.clearMappingTooltip', 'Bỏ liên kết cột này')}
                        >
                          <FaXmark className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Template Save Options */}
        <div className="border-border mt-4 flex flex-col gap-2 border-t pt-4">
          <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs font-medium select-none">
            <input
              type="checkbox"
              checked={saveAsTemplate}
              onChange={(e) => setSaveAsTemplate(e.target.checked)}
              className="border-border bg-background text-accent focus:ring-accent focus:ring-offset-card size-4 cursor-pointer rounded"
            />
            <span className="flex items-center gap-1.5">
              <LayoutTemplate className="text-muted-foreground size-3.5" />
              {t('excelMapping.saveTemplate', 'Save this mapping as a template')}
            </span>
          </label>

          {saveAsTemplate && (
            <div className="mt-1 max-w-sm">
              <Input
                type="text"
                placeholder={t(
                  'excelMapping.templateNamePlaceholder',
                  'E.g.: Buff export, personal sheet...'
                )}
                value={templateLabel}
                onChange={(e) => setTemplateLabel(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          )}
        </div>

        {/* Preview section */}
        {previewRows.length > 0 && (
          <div className="mt-4">
            <h4 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <FaInfo className="size-3 text-blue-600 dark:text-blue-400" />
              {t('excelMapping.preview', 'Preview (first 3 rows)')}
            </h4>
            <div className="border-border bg-surface-muted/20 w-full max-w-sm rounded-lg border p-3 sm:max-w-none">
              <div className="border-border bg-background w-full rounded-lg border p-3">
                <div className="w-full overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="bg-surface-muted/40 text-muted-foreground border-border border-b text-[10px] font-semibold uppercase">
                      <tr>
                        <th className="px-3 py-2 whitespace-nowrap">
                          {t('excelMapping.fieldName', 'Item Name')}
                        </th>
                        <th className="w-16 px-3 py-2 text-center whitespace-nowrap">
                          {t('excelMapping.fieldQuantityShort', 'Qty')}
                        </th>
                        <th className="w-28 px-3 py-2 text-right whitespace-nowrap">
                          {t('excelMapping.fieldBuyPrice', 'Buy Price')}
                        </th>
                        <th className="w-28 px-3 py-2 text-center whitespace-nowrap">
                          {t('excelMapping.fieldBuyDate', 'Buy Date')}
                        </th>
                        <th className="w-32 px-3 py-2 whitespace-nowrap">
                          {t('excelMapping.fieldNote', 'Note')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-border/50 divide-y">
                      {previewRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-surface-muted/20">
                          <td
                            className="text-foreground max-w-[150px] truncate px-3 py-2 font-medium whitespace-nowrap sm:max-w-[200px]"
                            title={row.marketHashName}
                          >
                            {row.marketHashName}
                          </td>
                          <td className="text-muted-foreground px-3 py-2 text-center whitespace-nowrap">
                            {row.quantity}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap text-blue-600 dark:text-blue-300">
                            {row.buyPrice.toLocaleString()}
                          </td>
                          <td className="text-muted-foreground px-3 py-2 text-center whitespace-nowrap">
                            {row.buyDate}
                          </td>
                          <td
                            className="text-muted-foreground max-w-[100px] truncate px-3 py-2 whitespace-nowrap sm:max-w-[120px]"
                            title={row.note}
                          >
                            {row.note}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="border-border mt-5 flex flex-col-reverse items-stretch justify-end gap-2.5 border-t pt-4 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-9 w-full px-4 text-xs font-medium sm:w-auto"
          >
            {t('excelMapping.cancelButton', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={isConfirmedDisabled}
            onClick={handleConfirmClick}
            className="bg-accent hover:bg-accent-hover text-accent-foreground shadow-accent/10 h-9 w-full justify-center px-5 text-xs font-bold shadow-md disabled:opacity-40 sm:w-auto"
          >
            {t('excelMapping.confirmButton', 'Confirm Mapping')}
            <FaArrowRight className="ml-1.5 size-3 shrink-0" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
