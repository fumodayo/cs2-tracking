"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FaFileExcel, FaGripVertical, FaCheck, FaTrash, FaInfo, FaArrowRight, FaFloppyDisk } from "react-icons/fa6";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type ColumnMapping,
  type MappingTemplate,
  type PortfolioImportRow,
  parseMatrixWithMapping,
} from "./portfolio-excel";

interface ImportExcelMappingDialogProps {
  open: boolean;
  fileName: string;
  excelHeaders: string[];
  matrix: unknown[][];
  headerRowIndex: number;
  suggestedMapping: Partial<ColumnMapping>;
  savedTemplates: MappingTemplate[];
  onClose: () => void;
  onConfirm: (
    mapping: ColumnMapping,
    saveAsTemplate: boolean,
    templateLabel: string
  ) => void;
  onDeleteTemplate?: (id: string) => void;
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
  
  // Mapping state: key -> header index
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateLabel, setTemplateLabel] = useState("");
  const [draggedHeaderIndex, setDraggedHeaderIndex] = useState<number | null>(null);
  const [hoveredTarget, setHoveredTarget] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<PortfolioImportRow[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // Target system fields definitions
  const systemFields = useMemo(() => [
    { key: "name", label: t("excelMapping.fieldName", "Item Name"), required: true, defaultValue: "" },
    { key: "quantity", label: t("excelMapping.fieldQuantity", "Quantity"), required: false, defaultValue: "1" },
    { key: "buyPrice", label: t("excelMapping.fieldBuyPrice", "Buy Price"), required: false, defaultValue: "0" },
    { key: "buyDate", label: t("excelMapping.fieldBuyDate", "Buy Date"), required: false, defaultValue: t("excelMapping.defaultValueToday", "Today") },
    { key: "note", label: t("excelMapping.fieldNote", "Note"), required: false, defaultValue: '"Import t\u1eeb Excel"' },
    { key: "caseId", label: t("excelMapping.fieldCaseId", "Case ID"), required: false, defaultValue: "empty" },
  ], [t]);

  // Fingerprint of current headers to auto-match template
  const headerFingerprint = useMemo(() => {
    return JSON.stringify([...excelHeaders].sort());
  }, [excelHeaders]);

  // Load template mapping
  const loadTemplate = (template: MappingTemplate) => {
    const newMapping: Partial<ColumnMapping> = {};
    const keys: (keyof ColumnMapping)[] = ["name", "quantity", "buyPrice", "buyDate", "note", "caseId"];
    keys.forEach((key) => {
      if (template.mapping[key] !== undefined && template.mapping[key]! < excelHeaders.length) {
        newMapping[key] = template.mapping[key];
      }
    });
    setMapping(newMapping);
  };

  // Initialize mapping with suggested or matching template
  useEffect(() => {
    if (open) {
      // Check if there is a saved template with matching headers fingerprint
      const autoMatch = savedTemplates.find(
        (tpl) => tpl.headerFingerprint === headerFingerprint
      );
      if (autoMatch) {
        loadTemplate(autoMatch);
        setSelectedTemplateId(autoMatch.id);
      } else {
        setMapping(suggestedMapping);
        setSelectedTemplateId("");
      }
      setSaveAsTemplate(false);
      setTemplateLabel("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, suggestedMapping, savedTemplates, headerFingerprint]);

  // Update preview table when mapping changes
  useEffect(() => {
    if (mapping.name === undefined) {
      setPreviewRows([]);
      return;
    }
    
    try {
      const rows = parseMatrixWithMapping(matrix, mapping as ColumnMapping, headerRowIndex);
      setPreviewRows(rows.slice(0, 3));
    } catch (err) {
      console.error("Preview error:", err);
      setPreviewRows([]);
    }
  }, [mapping, matrix, headerRowIndex]);

  const handleFieldChange = (key: string, headerIndexVal: string) => {
    const index = headerIndexVal === "" ? undefined : parseInt(headerIndexVal, 10);
    setMapping((prev) => ({
      ...prev,
      [key]: index,
    }));
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

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedHeaderIndex(index);
    e.dataTransfer.effectAllowed = "move";
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

  // Find if a header index is currently mapped to any system field
  const getMappedField = (index: number) => {
    const match = Object.entries(mapping).find(([, val]) => val === index);
    return match ? match[0] : null;
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-4xl border border-border bg-card p-6 text-foreground shadow-[0_30px_90px_rgba(0,0,0,0.25)] dark:shadow-[0_30px_90px_rgba(0,0,0,0.95)] backdrop-blur-3xl sm:rounded-xl">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold text-foreground">
            {t("excelMapping.title", "Excel Column Mapping")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t(
              "excelMapping.description",
              "Drag Excel columns from the left and drop them into the corresponding system fields on the right, or select them from the dropdown."
            )}
            <span className="ml-1 font-semibold text-blue-600 dark:text-blue-400">({fileName})</span>
          </DialogDescription>
        </DialogHeader>

        {/* Template Selection */}
        {savedTemplates.length > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-surface-muted/30 px-4 py-2.5">
            <span className="text-xs text-muted-foreground font-medium">
              {t("excelMapping.selectTemplate", "Select saved template:")}
            </span>
            <div className="flex items-center gap-2">
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:border-accent outline-none cursor-pointer"
              >
                <option value="">{t("excelMapping.noTemplates", "— Default suggestion —")}</option>
                {savedTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.label}
                  </option>
                ))}
              </select>
              {selectedTemplateId && onDeleteTemplate && (
                <Button
                  variant="outline"
                  onClick={() => {
                    onDeleteTemplate(selectedTemplateId);
                    setSelectedTemplateId("");
                  }}
                  className="h-8 w-8 p-0 border-border text-muted-foreground hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                  title={t("excelMapping.deleteTemplateTooltip", "Delete this template")}
                >
                  <FaTrash className="size-3" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Main Grid: Left Excel columns, Right System fields */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
          {/* Left Side: Excel Columns */}
          <div className="md:col-span-2 flex flex-col">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("excelMapping.excelColumns", "Excel Columns")}
            </h3>
            <div className="flex-1 max-h-[300px] overflow-y-auto rounded-lg border border-border bg-surface-muted/20 p-3 space-y-2">
              {excelHeaders.map((header, idx) => {
                const mappedTo = getMappedField(idx);
                return (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`group flex items-center justify-between rounded-md border px-3 py-2.5 text-xs font-medium transition-all cursor-grab active:cursor-grabbing shadow-sm ${
                      mappedTo
                        ? "border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 text-emerald-600/70 dark:text-emerald-400/70 opacity-60"
                        : "border-border bg-background hover:border-stone-300 dark:hover:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-850 text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden mr-1">
                      <FaGripVertical className="size-3 text-stone-400 dark:text-stone-500 shrink-0 cursor-grab" />
                      <FaFileExcel className="size-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">{header}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground select-none font-semibold shrink-0 bg-surface-muted/40 px-1.5 py-0.5 rounded border border-border/60">
                      #{idx + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side: System Fields Target Slots */}
          <div className="md:col-span-3 flex flex-col">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("excelMapping.systemFields", "System Fields")}
            </h3>
            <div className="flex-1 max-h-[300px] overflow-y-auto rounded-lg border border-border bg-surface-muted/20 p-3 space-y-2.5">
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
                        ? "border-accent bg-accent/5 ring-1 ring-accent"
                        : currentMappedIdx !== undefined
                        ? "border-border bg-background"
                        : "border-border/60 bg-surface-muted/10"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground">
                          {field.label}
                        </span>
                        {field.required ? (
                          <span className="text-[10px] font-bold uppercase text-red-500 dark:text-red-400 select-none">
                            *{t("excelMapping.required", "Required")}
                          </span>
                        ) : (
                          <span className="text-[9px] text-muted-foreground font-normal select-none">
                            {t("excelMapping.defaultValue", { value: field.defaultValue })}
                          </span>
                        )}
                      </div>
                      
                      {currentMappedIdx !== undefined && (
                        <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 select-none">
                          <FaCheck className="size-2.5" />
                          <span className="max-w-[120px] truncate">
                            {excelHeaders[currentMappedIdx]}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={currentMappedIdx === undefined ? "" : currentMappedIdx.toString()}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground focus:border-accent outline-none cursor-pointer transition-all hover:bg-surface-muted/30"
                      >
                        <option value="">{t("excelMapping.notMapped", "— Not mapped —")}</option>
                        {excelHeaders.map((header, idx) => (
                          <option key={idx} value={idx.toString()}>
                            {header} (#{idx + 1})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Template Save Options */}
        <div className="mt-4 border-t border-border pt-4 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={saveAsTemplate}
              onChange={(e) => setSaveAsTemplate(e.target.checked)}
              className="size-4 rounded border-border bg-background text-accent focus:ring-accent focus:ring-offset-card cursor-pointer"
            />
            <span className="flex items-center gap-1.5">
              <FaFloppyDisk className="size-3" />
              {t("excelMapping.saveTemplate", "Save this mapping as a template")}
            </span>
          </label>

          {saveAsTemplate && (
            <div className="mt-1 max-w-sm">
              <Input
                type="text"
                placeholder={t("excelMapping.templateNamePlaceholder", "E.g.: Buff export, personal sheet...")}
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
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FaInfo className="size-3 text-blue-600 dark:text-blue-400" />
              {t("excelMapping.preview", "Preview (first 3 rows)")}
            </h4>
            <div className="overflow-x-auto rounded-lg border border-border bg-surface-muted/20">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-muted/40 text-[10px] uppercase text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="py-2 px-3">{t("excelMapping.fieldName", "Item Name")}</th>
                    <th className="py-2 px-3 w-16 text-center">{t("excelMapping.fieldQuantityShort", "Qty")}</th>
                    <th className="py-2 px-3 w-28 text-right">{t("excelMapping.fieldBuyPrice", "Buy Price")}</th>
                    <th className="py-2 px-3 w-28 text-center">{t("excelMapping.fieldBuyDate", "Buy Date")}</th>
                    <th className="py-2 px-3 w-32">{t("excelMapping.fieldNote", "Note")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-surface-muted/20">
                      <td className="py-2 px-3 font-medium text-foreground truncate max-w-[200px]" title={row.marketHashName}>
                        {row.marketHashName}
                      </td>
                      <td className="py-2 px-3 text-center text-muted-foreground">{row.quantity}</td>
                      <td className="py-2 px-3 text-right text-blue-600 dark:text-blue-300">{row.buyPrice.toLocaleString()}</td>
                      <td className="py-2 px-3 text-center text-muted-foreground">{row.buyDate}</td>
                      <td className="py-2 px-3 text-muted-foreground truncate max-w-[120px]" title={row.note}>
                        {row.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-border pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-9 px-4 text-xs font-medium"
          >
            {t("excelMapping.cancelButton", "Cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={isConfirmedDisabled}
            onClick={handleConfirmClick}
            className="h-9 bg-accent hover:bg-accent-hover text-accent-foreground px-5 text-xs font-bold shadow-md shadow-accent/10 disabled:opacity-40"
          >
            {t("excelMapping.confirmButton", "Confirm Mapping")}
            <FaArrowRight className="ml-1.5 size-3" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
