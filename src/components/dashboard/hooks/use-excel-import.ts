import { useState, useMemo, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useImportStore, importStore, toast } from '@/stores';
import { getErrorMessage } from '@/utils/error';
import {
  readExcelHeaders,
  parseMatrixWithMapping,
  autoSuggestMapping,
} from '@/components/portfolio';
import type { PortfolioImportRow, ColumnMapping, MappingTemplate } from '@/components/portfolio';
import { PORTFOLIO_QUERY_KEY, importPortfolioRows } from '@/lib/api-client/portfolio-api';
import type { RecentImport } from '../recent-imports-popover';
import { translateAccountError } from '@/components/inventory-scanner/utils';

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
  const [excelFileName, setExcelFileName] = useState<string>('');

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
    'cs2t_excelMappingTemplates',
    []
  );

  const importMutation = useMutation({
    mutationFn: (rows: PortfolioImportRow[]) =>
      importPortfolioRows(rows, {
        onProgress: (event) => {
          importStore.setState({
            phase: 'uploading',
            fileName: importStore.getState().fileName,
            rowsCount: event.total,
            importedCount: event.index + 1,
            message: event.message,
          });
        },
      }),
    onSuccess: (report, rows) => {
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      const current = importStore.getState();
      importStore.setState({
        phase: 'done',
        fileName: current.phase === 'uploading' ? current.fileName : 'Excel',
        rowsCount: rows.length,
        importedCount: report.importResult?.importedCount ?? rows.length,
        importedIds: report.importResult?.importedIds ?? [],
      });
      if (report.importResult?.importedIds && report.importResult.importedIds.length > 0) {
        const importedIds = report.importResult.importedIds;
        const itemsDetails = report.rows
          .filter((row) => importedIds.includes(row.item.id))
          .map((row) => ({
            name: row.case?.name || row.item.note || 'Vật phẩm',
            quantity: row.item.quantity,
            buyPrice: row.item.buyPrice,
            buyDate: row.item.buyDate,
            note: row.item.note,
            createdAt: row.item.createdAt,
          }));

        addRecentImport({
          id: Date.now().toString(),
          fileName: current.phase === 'uploading' ? current.fileName || 'Excel' : 'Excel',
          date: new Date().toISOString(),
          importedCount: report.importResult.importedCount,
          importedIds: report.importResult.importedIds,
          items: itemsDetails,
        });
      }
      setTimeout(() => {
        if (importStore.getState().phase === 'done') {
          importStore.setState({ phase: 'idle' });
        }
      }, 8000);
      toast.success(
        t('dashboard.importSuccess', {
          count: report.importResult?.importedCount ?? rows.length,
        })
      );
      setError(null);
    },
    onError: (err) => {
      const msg = translateAccountError(getErrorMessage(err), t);
      toast.error(t('dashboard.importError'), {
        description: msg,
      });
      setError(msg);
    },
  });

  const handleExcelSource = useCallback(
    async (source: File | string, fileName: string) => {
      try {
        setError(null);
        importStore.setState({ phase: 'reading', fileName });
        const { headers, headerRowIndex, matrix } = await readExcelHeaders(source);
        importStore.setState({ phase: 'idle' });

        if (headers.length === 0) {
          throw new Error(t('excelMapping.emptyFile', 'No columns found in the file.'));
        }

        setMappingDialogData({ headers, headerRowIndex, matrix, fileName });
      } catch (err) {
        const msg = translateAccountError(getErrorMessage(err), t);
        importStore.setState({ phase: 'error', message: msg });
        setError(msg);
      }
    },
    [t, setError]
  );

  const handleMappingConfirm = useCallback(
    (mapping: ColumnMapping, saveAsTemplate: boolean, templateLabel: string) => {
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
        if (rows.length === 0) {
          throw new Error(
            t(
              'excelMapping.noRowsAfterMapping',
              'Không tìm thấy dòng hợp lệ sau khi liên kết. Hãy bỏ cột trống/null khỏi "Tên vật phẩm" và chọn đúng cột tên vật phẩm.'
            )
          );
        }
        setExcelImportRows(rows);
        setExcelFileName(mappingDialogData.fileName);
        setMappingDialogData(null);
      } catch (err) {
        setError(translateAccountError(getErrorMessage(err), t));
      }
    },
    [mappingDialogData, setSavedTemplates, setError, t]
  );

  const handleDeleteTemplate = useCallback(
    (id: string) => {
      setSavedTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
    },
    [setSavedTemplates]
  );

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    await handleExcelSource(file, file.name);
  }

  const handleConfirmExcelImport = (confirmedRows: PortfolioImportRow[]) => {
    setExcelImportRows(null);
    if (confirmedRows.length === 0) return;
    importStore.setState({
      phase: 'uploading',
      fileName: excelFileName,
      rowsCount: confirmedRows.length,
    });
    importMutation.mutate(confirmedRows);
  };

  const importBusy =
    importStatus.phase === 'reading' ||
    importStatus.phase === 'uploading' ||
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
