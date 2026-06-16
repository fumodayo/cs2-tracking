import { useState, useMemo, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useImportStore, importStore, toast } from "@/stores";
import { getErrorMessage } from "@/utils/error";
import {
  readExcelHeaders,
  parseMatrixWithMapping,
  autoSuggestMapping,
} from "@/components/portfolio";
import type {
  PortfolioImportRow,
  ColumnMapping,
  MappingTemplate,
} from "@/components/portfolio";
import {
  PORTFOLIO_QUERY_KEY,
  importPortfolioRows,
} from "@/services/portfolio-api";
import type { RecentImport } from "../recent-imports-popover";

interface UseExcelImportProps {
  addRecentImport: (item: RecentImport) => void;
  setError: (error: string | null) => void;
}

export function useExcelImport({ addRecentImport, setError }: UseExcelImportProps) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const importStatus = useImportStore();

  const [excelImportRows, setExcelImportRows] = useState<PortfolioImportRow[] | null>(null);
  const [excelFileName, setExcelFileName] = useState<string>("");
  
  const [mappingDialogData, setMappingDialogData] = useState<{
    headers: string[];
    headerRowIndex: number;
    matrix: unknown[][];
    fileName: string;
  } | null>(null);

  const suggestedMapping = useMemo(() => {
    if (!mappingDialogData) return {};
    return autoSuggestMapping(mappingDialogData.headers);
  }, [mappingDialogData]);

  const [savedTemplates, setSavedTemplates] = useLocalStorage<MappingTemplate[]>(
    "cs2t_excelMappingTemplates",
    []
  );

  const importMutation = useMutation({
    mutationFn: importPortfolioRows,
    onSuccess: (report, rows) => {
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      const current = importStore.getState();
      importStore.setState({
        phase: "done",
        fileName: current.phase === "uploading" ? current.fileName : "Excel",
        rowsCount: rows.length,
        importedCount: report.importResult?.importedCount ?? rows.length,
        importedIds: report.importResult?.importedIds ?? [],
      });
      if (
        report.importResult?.importedIds &&
        report.importResult.importedIds.length > 0
      ) {
        addRecentImport({
          id: Date.now().toString(),
          fileName:
            current.phase === "uploading"
              ? current.fileName || "Excel"
              : "Excel",
          date: new Date().toISOString(),
          importedCount: report.importResult.importedCount,
          importedIds: report.importResult.importedIds,
        });
      }
      setTimeout(() => {
        if (importStore.getState().phase === "done") {
          importStore.setState({ phase: "idle" });
        }
      }, 8000);
      toast.success(
        t("dashboard.importSuccess", {
          count: report.importResult?.importedCount ?? rows.length,
        }),
      );
      setError(null);
    },
    onError: (err) => {
      toast.error(t("dashboard.importError"), {
        description: getErrorMessage(err),
      });
      setError(getErrorMessage(err));
    },
  });

  const handleExcelSource = useCallback(async (source: File | string, fileName: string) => {
    try {
      setError(null);
      importStore.setState({ phase: "reading", fileName });
      const { headers, headerRowIndex, matrix } = await readExcelHeaders(source);
      importStore.setState({ phase: "idle" });

      if (headers.length === 0) {
        throw new Error(t("excelMapping.emptyFile", "Không tìm thấy cột nào trong file."));
      }

      setMappingDialogData({ headers, headerRowIndex, matrix, fileName });
    } catch (err) {
      importStore.setState({ phase: "error", message: getErrorMessage(err) });
      setError(getErrorMessage(err));
    }
  }, [t, setError]);

  const handleMappingConfirm = useCallback((
    mapping: ColumnMapping,
    saveAsTemplate: boolean,
    templateLabel: string
  ) => {
    if (!mappingDialogData) return;

    if (saveAsTemplate && templateLabel.trim()) {
      const fingerprint = JSON.stringify([...mappingDialogData.headers].sort());
      const newTemplate: MappingTemplate = {
        id: crypto.randomUUID(),
        label: templateLabel.trim(),
        headerFingerprint: fingerprint,
        mapping,
        createdAt: new Date().toISOString(),
      };
      setSavedTemplates((prev) => [...prev, newTemplate]);
    }

    try {
      setError(null);
      const rows = parseMatrixWithMapping(
        mappingDialogData.matrix,
        mapping,
        mappingDialogData.headerRowIndex
      );
      setExcelImportRows(rows);
      setExcelFileName(mappingDialogData.fileName);
      setMappingDialogData(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [mappingDialogData, setSavedTemplates, setError]);

  const handleDeleteTemplate = useCallback((id: string) => {
    setSavedTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
  }, [setSavedTemplates]);

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    await handleExcelSource(file, file.name);
  }

  const handleConfirmExcelImport = (confirmedRows: PortfolioImportRow[]) => {
    setExcelImportRows(null);
    if (confirmedRows.length === 0) return;
    importStore.setState({
      phase: "uploading",
      fileName: excelFileName,
      rowsCount: confirmedRows.length,
    });
    importMutation.mutate(confirmedRows);
  };

  const importBusy =
    importStatus.phase === "reading" ||
    importStatus.phase === "uploading" ||
    importMutation.isPending;

  return {
    importBusy,
    importStatus,
    excelImportRows,
    setExcelImportRows,
    excelFileName,
    importInputRef,
    mappingDialogData,
    setMappingDialogData,
    suggestedMapping,
    savedTemplates,
    importMutation,
    handleExcelSource,
    handleMappingConfirm,
    handleDeleteTemplate,
    handleImportFile,
    handleConfirmExcelImport,
  };
}
