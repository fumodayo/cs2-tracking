import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef } from "react";
import { useSession } from "@/components/auth/use-session";
import { useTranslation } from "react-i18next";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useImportStore, importStore, toast, toastStore } from "@/stores";
import { useRecentImports } from "./recent-imports-popover";
import { refreshBuffPrice } from "@/services/buff-api";
import {
  parsePortfolioExcelFile,
  buildPortfolioTableRows,
} from "@/components/portfolio";
import type { PortfolioReportDto } from "@/types/report";
import type { PortfolioTableRow, PortfolioImportRow } from "@/components/portfolio";
import {
  PORTFOLIO_QUERY_KEY,
  fetchPortfolioReport,
  refreshPortfolioPrices,
  addPortfolioItem,
  deletePortfolioItem,
  deleteManyPortfolioItems,
  updatePortfolioItem,
  importPortfolioRows,
} from "@/services/portfolio-api";
import { getErrorMessage } from "@/utils/error";

export function useDashboard() {
  const queryClient = useQueryClient();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("authError"),
  );
  const importStatus = useImportStore();
  const { recentImports, addRecentImport, removeRecentImport } =
    useRecentImports();
  const [filteredRows, setFilteredRows] = useState<PortfolioTableRow[] | null>(
    null,
  );
  const [excelImportRows, setExcelImportRows] = useState<PortfolioImportRow[] | null>(null);
  const [excelFileName, setExcelFileName] = useState<string>("");
  const { user, googleConfigured } = useSession();
  const { t } = useTranslation();

  const [buffPricesCny, setBuffPricesCny] = useLocalStorage<
    Record<string, number>
  >("cs2t_buffPricesCny", {});
  const [buffCnyToVndRate, setBuffCnyToVndRate] = useLocalStorage<number>(
    "cs2t_buffCnyToVndRate",
    3600,
  );

  const handleUpdateBuffPrice = (marketHashName: string, priceCny: number | null) => {
    setBuffPricesCny((prev) => {
      const next = { ...prev };
      if (priceCny === null || priceCny <= 0) {
        delete next[marketHashName];
      } else {
        next[marketHashName] = priceCny;
      }
      return next;
    });
  };

  const handleUpdateBuffRate = (rate: number) => {
    setBuffCnyToVndRate(rate);
  };

  const reportQuery = useQuery({
    queryKey: PORTFOLIO_QUERY_KEY,
    queryFn: fetchPortfolioReport,
  });

  function setMutationError(mutationError: unknown) {
    setError(getErrorMessage(mutationError));
  }

  // Helper to standardise loading, success and error toast callbacks for mutations
  const toastCallbacks = <TData, TVariables>(
    loadingKey: string,
    successKey: string,
    errorKey: string,
  ) => {
    return {
      onMutate: () => {
        const id = toast.loading(t(loadingKey));
        return { toastId: id };
      },
      onSuccess: (
        _data: TData,
        _variables: TVariables,
        context: { toastId: string } | undefined,
      ) => {
        if (context?.toastId) {
          toastStore.update(context.toastId, {
            type: "success",
            title: t(successKey),
            duration: 4000,
          });
        }
      },
      onError: (
        err: unknown,
        _variables: TVariables,
        context: { toastId: string } | undefined,
      ) => {
        if (context?.toastId) {
          toastStore.update(context.toastId, {
            type: "error",
            title: t(errorKey),
            description: getErrorMessage(err),
            duration: 5000,
          });
        }
        setMutationError(err);
      },
    };
  };

  const refreshCallbacks = toastCallbacks<PortfolioReportDto, void>(
    "dashboard.refreshingPrices",
    "dashboard.refreshSuccess",
    "dashboard.refreshError",
  );

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const report = await refreshPortfolioPrices();

      const uniqueMarketHashNames = Array.from(
        new Set(
          report.rows.map((row) => row.case.marketHashName).filter(Boolean),
        ),
      );

      const skinsToRefresh = uniqueMarketHashNames.filter((name) => {
        const prevPrice = buffPricesCny[name];
        return typeof prevPrice === "number" && prevPrice > 0;
      });

      if (skinsToRefresh.length > 0) {
        const newPrices: Record<string, number> = {};
        const concurrency = 4;
        const items = [...skinsToRefresh];
        let nextIndex = 0;

        const fetchWorker = async () => {
          while (nextIndex < items.length) {
            const currentHashName = items[nextIndex++];
            try {
              const data = await refreshBuffPrice(
                currentHashName,
                buffCnyToVndRate,
              );
              if (data) {
                newPrices[currentHashName] = data.priceCny;
              }
            } catch (err) {
              console.error(
                `Failed to refresh Buff price for ${currentHashName}:`,
                err,
              );
            }
          }
        };

        const workers = Array.from(
          { length: Math.min(concurrency, items.length) },
          fetchWorker,
        );
        await Promise.all(workers);

        if (Object.keys(newPrices).length > 0) {
          setBuffPricesCny((prev) => {
            const next = { ...prev, ...newPrices };
            localStorage.setItem("cs2t_buffPricesCny", JSON.stringify(next));
            return next;
          });
        }
      }

      return report;
    },
    onMutate: refreshCallbacks.onMutate,
    onSuccess: (report, variables, context) => {
      refreshCallbacks.onSuccess(report, variables, context);
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      setError(null);
    },
    onError: (err, variables, context) => {
      refreshCallbacks.onError(err, variables, context);
    },
  });

  const addCallbacks = toastCallbacks<PortfolioReportDto, Parameters<typeof addPortfolioItem>[0]>(
    "dashboard.savingItem",
    "dashboard.itemSaved",
    "dashboard.itemSaveError",
  );

  const addMutation = useMutation({
    mutationFn: addPortfolioItem,
    onMutate: addCallbacks.onMutate,
    onSuccess: (report, variables, context) => {
      addCallbacks.onSuccess(report, variables, context);
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      queryClient.invalidateQueries({ queryKey: ["storage_units"] });
      setDialogOpen(false);
      setError(null);
    },
    onError: (err, variables, context) => {
      addCallbacks.onError(err, variables, context);
    },
  });

  const deleteCallbacks = toastCallbacks<PortfolioReportDto, string>(
    "dashboard.deletingItem",
    "dashboard.itemDeleted",
    "dashboard.itemDeleteError",
  );

  const deleteMutation = useMutation({
    mutationFn: deletePortfolioItem,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: PORTFOLIO_QUERY_KEY });
      const previousReport =
        queryClient.getQueryData<PortfolioReportDto>(PORTFOLIO_QUERY_KEY);
      if (previousReport) {
        queryClient.setQueryData<PortfolioReportDto>(PORTFOLIO_QUERY_KEY, {
          ...previousReport,
          rows: previousReport.rows.filter((row) => row.item.id !== id),
        });
      }
      const toastContext = deleteCallbacks.onMutate();
      return { previousReport, toastId: toastContext.toastId };
    },
    onSuccess: (report, id, context) => {
      deleteCallbacks.onSuccess(report, id, context);
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      queryClient.invalidateQueries({ queryKey: ["storage_units"] });
      setError(null);
    },
    onError: (err, id, context) => {
      if (context?.previousReport) {
        queryClient.setQueryData(PORTFOLIO_QUERY_KEY, context.previousReport);
      }
      deleteCallbacks.onError(err, id, context);
    },
  });

  const deleteManyCallbacks = toastCallbacks<PortfolioReportDto, string[]>(
    "dashboard.deletingItems",
    "dashboard.itemsDeleted",
    "dashboard.itemsDeleteError",
  );

  const deleteManyMutation = useMutation({
    mutationFn: deleteManyPortfolioItems,
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: PORTFOLIO_QUERY_KEY });
      const previousReport =
        queryClient.getQueryData<PortfolioReportDto>(PORTFOLIO_QUERY_KEY);
      if (previousReport) {
        queryClient.setQueryData<PortfolioReportDto>(PORTFOLIO_QUERY_KEY, {
          ...previousReport,
          rows: previousReport.rows.filter((row) => !ids.includes(row.item.id)),
        });
      }
      const toastContext = deleteManyCallbacks.onMutate();
      return { previousReport, toastId: toastContext.toastId };
    },
    onSuccess: (report, ids, context) => {
      deleteManyCallbacks.onSuccess(report, ids, context);
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      queryClient.invalidateQueries({ queryKey: ["storage_units"] });
      setError(null);
    },
    onError: (err, ids, context) => {
      if (context?.previousReport) {
        queryClient.setQueryData(PORTFOLIO_QUERY_KEY, context.previousReport);
      }
      deleteManyCallbacks.onError(err, ids, context);
    },
  });

  const updateCallbacks = toastCallbacks<PortfolioReportDto, Parameters<typeof updatePortfolioItem>[0]>(
    "dashboard.updatingItem",
    "dashboard.itemUpdated",
    "dashboard.itemUpdateError",
  );

  const updateMutation = useMutation({
    mutationFn: updatePortfolioItem,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: PORTFOLIO_QUERY_KEY });
      const previousReport =
        queryClient.getQueryData<PortfolioReportDto>(PORTFOLIO_QUERY_KEY);
      if (previousReport) {
        queryClient.setQueryData<PortfolioReportDto>(PORTFOLIO_QUERY_KEY, {
          ...previousReport,
          rows: previousReport.rows.map((row) => {
            if (row.item.id === variables.id) {
              const updatedItem = { ...row.item };
              if (variables.buyPrice !== undefined)
                updatedItem.buyPrice = variables.buyPrice;
              if (variables.quantity !== undefined)
                updatedItem.quantity = variables.quantity;
              if (variables.note !== undefined)
                updatedItem.note = variables.note;
              return {
                ...row,
                item: updatedItem,
                investedValue: updatedItem.buyPrice * updatedItem.quantity,
              };
            }
            return row;
          }),
        });
      }
      const toastContext = updateCallbacks.onMutate();
      return { previousReport, toastId: toastContext.toastId };
    },
    onSuccess: (report, variables, context) => {
      updateCallbacks.onSuccess(report, variables, context);
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      queryClient.invalidateQueries({ queryKey: ["storage_units"] });
      setError(null);
    },
    onError: (err, variables, context) => {
      if (context?.previousReport) {
        queryClient.setQueryData(PORTFOLIO_QUERY_KEY, context.previousReport);
      }
      updateCallbacks.onError(err, variables, context);
    },
  });

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
      setMutationError(err);
    },
  });

  const report = reportQuery.data ?? null;
  const loading = reportQuery.isLoading;
  const deletingId = deleteMutation.isPending
    ? (deleteMutation.variables ?? null)
    : null;
  const importBusy =
    importStatus.phase === "reading" ||
    importStatus.phase === "uploading" ||
    importMutation.isPending;

  const computedTransactionRows = useMemo(() => {
    if (!report) return [];
    return buildPortfolioTableRows(
      report,
      "transactions",
      buffPricesCny,
      buffCnyToVndRate,
    );
  }, [report, buffPricesCny, buffCnyToVndRate]);

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      setError(null);
      importStore.setState({ phase: "reading", fileName: file.name });
      const rows = await parsePortfolioExcelFile(file);
      importStore.setState({ phase: "idle" });
      setExcelImportRows(rows);
      setExcelFileName(file.name);
    } catch (importError) {
      importStore.setState({
        phase: "error",
        message: getErrorMessage(importError),
      });
      setError(getErrorMessage(importError));
    }
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

  return {
    // Core data
    report,
    loading,
    error,
    setError,
    user,
    googleConfigured,
    t,

    // Dialog state
    dialog: {
      open: dialogOpen,
      setOpen: setDialogOpen,
    },

    // Buff pricing
    buff: {
      pricesCny: buffPricesCny,
      cnyToVndRate: buffCnyToVndRate,
      updatePrice: handleUpdateBuffPrice,
      updateRate: handleUpdateBuffRate,
    },

    // Excel import
    excel: {
      busy: importBusy,
      status: importStatus,
      rows: excelImportRows,
      setRows: setExcelImportRows,
      fileName: excelFileName,
      inputRef: importInputRef,
      handleFile: handleImportFile,
      handleConfirm: handleConfirmExcelImport,
    },

    // Recent imports
    recentImports: {
      list: recentImports,
      remove: removeRecentImport,
    },

    // Table state
    table: {
      filteredRows,
      setFilteredRows,
      computedTransactionRows,
      deletingId,
    },

    // Queries & Mutations
    reportQuery,
    mutations: {
      add: addMutation,
      delete: deleteMutation,
      deleteMany: deleteManyMutation,
      update: updateMutation,
      refresh: refreshMutation,
      import: importMutation,
    },
  };
}
