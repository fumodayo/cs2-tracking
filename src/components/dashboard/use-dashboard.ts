import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useSession } from "@/components/auth/use-session";
import { useTranslation } from "react-i18next";
import { useRecentImports } from "./recent-imports-popover";
import {
  useBuffPricing,
  usePortfolioMutations,
  useExcelImport,
} from "./hooks";
import { buildPortfolioTableRows } from "@/components/portfolio";
import type { PortfolioTableRow } from "@/components/portfolio";
import {
  PORTFOLIO_QUERY_KEY,
  fetchPortfolioReport,
} from "@/lib/api-client/portfolio-api";
import { fetchSteamAccounts, STEAM_ACCOUNTS_QUERY_KEY } from "@/lib/api-client/steam-accounts-api";

export function useDashboard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("authError")
  );
  
  const recentImportsState = useRecentImports();
  const [filteredRows, setFilteredRows] = useState<PortfolioTableRow[] | null>(null);

  const { user, googleConfigured } = useSession();
  const { t } = useTranslation();

  // Sub-hooks
  const buff = useBuffPricing();
  
  const mutations = usePortfolioMutations({
    buffPricesCny: buff.pricesCny,
    buffCnyToVndRate: buff.cnyToVndRate,
    setBuffPricesCny: buff.setPricesCny,
    setDialogOpen,
    setError,
  });

  const excel = useExcelImport({
    addRecentImport: recentImportsState.addRecentImport,
    setError,
  });

  const reportQuery = useQuery({
    queryKey: PORTFOLIO_QUERY_KEY,
    queryFn: fetchPortfolioReport,
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  const accountsQuery = useQuery({
    queryKey: STEAM_ACCOUNTS_QUERY_KEY,
    queryFn: () => fetchSteamAccounts(t("dashboard.cannotLoadAccounts")),
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  const report = reportQuery.data ?? null;
  const loading = reportQuery.isLoading;
  const deletingId = mutations.deleteMutation.isPending
    ? (mutations.deleteMutation.variables ?? null)
    : null;

  const computedTransactionRows = useMemo(() => {
    if (!report) return [];
    return buildPortfolioTableRows(
      report,
      "transactions",
      buff.pricesCny,
      buff.cnyToVndRate
    );
  }, [report, buff.pricesCny, buff.cnyToVndRate]);

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
      pricesCny: buff.pricesCny,
      cnyToVndRate: buff.cnyToVndRate,
      updatePrice: buff.updatePrice,
      updateRate: buff.updateRate,
    },

    // Excel import
    excel: {
      busy: excel.importBusy,
      status: excel.importStatus,
      rows: excel.excelImportRows,
      setRows: excel.setExcelImportRows,
      fileName: excel.excelFileName,
      inputRef: excel.importInputRef,
      handleFile: excel.handleImportFile,
      handleSource: excel.handleExcelSource,
      handleConfirm: excel.handleConfirmExcelImport,
    },

    // Mapping state
    mapping: {
      data: excel.mappingDialogData,
      close: () => excel.setMappingDialogData(null),
      confirm: excel.handleMappingConfirm,
      templates: excel.savedTemplates,
      deleteTemplate: excel.handleDeleteTemplate,
      suggestedMapping: excel.suggestedMapping,
    },

    // Recent imports
    recentImports: {
      list: recentImportsState.recentImports,
      remove: recentImportsState.removeRecentImport,
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
    accountsQuery,
    mutations: {
      add: mutations.addMutation,
      delete: mutations.deleteMutation,
      deleteMany: mutations.deleteManyMutation,
      update: mutations.updateMutation,
      refresh: mutations.refreshMutation,
      import: excel.importMutation,
    },
  };
}
