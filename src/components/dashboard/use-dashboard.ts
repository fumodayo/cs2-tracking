import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSession } from '@/components/auth/use-session';
import { useTranslation } from 'react-i18next';
import { useRecentImports } from './recent-imports-popover';
import { usePortfolioRealtime } from '@/hooks/use-portfolio-realtime';
import { useBuffPricing, usePortfolioMutations, useExcelImport } from './hooks';
import { useUserPreferencesRealtime } from './hooks/use-user-preferences';
import type { PortfolioTableRow } from '@/components/portfolio';
import { PORTFOLIO_QUERY_KEY, fetchPortfolioReport } from '@/lib/api-client/portfolio-api';
import { fetchSteamAccounts, STEAM_ACCOUNTS_QUERY_KEY } from '@/lib/api-client/steam-accounts-api';
import { usePortfolioReportSnapshot } from './use-portfolio-report-snapshot';

export function useDashboard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('authError')
  );

  const [filteredRows, setFilteredRows] = useState<PortfolioTableRow[] | null>(null);

  const { user, googleConfigured, loading: sessionLoading } = useSession();
  const recentImportsState = useRecentImports({ user, sessionLoading });
  const { t } = useTranslation();
  usePortfolioRealtime(Boolean(user), user ? `google:${user.id}` : undefined);
  useUserPreferencesRealtime({ user, sessionLoading });

  // Các sub-hook
  const buff = useBuffPricing({ user, sessionLoading });

  const mutations = usePortfolioMutations({
    buffPricesCny: buff.pricesCny,
    buffCnyToVndRate: buff.cnyToVndRate,
    mergeBuffPrices: buff.mergePrices,
    setDialogOpen,
    setError,
  });

  const excel = useExcelImport({
    user,
    sessionLoading,
    addRecentImport: recentImportsState.addRecentImport,
    setError,
  });

  const reportQuery = useQuery({
    queryKey: PORTFOLIO_QUERY_KEY,
    queryFn: fetchPortfolioReport,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: !!user,
  });

  const accountsQuery = useQuery({
    queryKey: STEAM_ACCOUNTS_QUERY_KEY,
    queryFn: () => fetchSteamAccounts(t('dashboard.cannotLoadAccounts')),
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  const cachedReport = usePortfolioReportSnapshot(user?.id ?? null, reportQuery.data ?? null);
  const report = reportQuery.data ?? cachedReport ?? null;
  const loading = reportQuery.isLoading && !cachedReport;
  const deletingId = mutations.deleteMutation.isPending
    ? (mutations.deleteMutation.variables ?? null)
    : null;

  return {
    // Dữ liệu lõi
    report,
    loading,
    error,
    setError,
    user,
    googleConfigured,
    sessionLoading,
    t,

    // Trạng thái dialog
    dialog: {
      open: dialogOpen,
      setOpen: setDialogOpen,
    },

    // Định giá Buff
    buff: {
      pricesCny: buff.pricesCny,
      cnyToVndRate: buff.cnyToVndRate,
      updatePrice: buff.updatePrice,
      updateRate: buff.updateRate,
    },

    // Import Excel
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

    // Trạng thái mapping
    mapping: {
      data: excel.mappingDialogData,
      close: () => excel.setMappingDialogData(null),
      confirm: excel.handleMappingConfirm,
      templates: excel.savedTemplates,
      deleteTemplate: excel.handleDeleteTemplate,
      suggestedMapping: excel.suggestedMapping,
    },

    // Các lần import gần đây
    recentImports: {
      list: recentImportsState.recentImports,
      remove: recentImportsState.removeRecentImport,
    },

    // Trạng thái bảng
    table: {
      filteredRows,
      setFilteredRows,
      deletingId,
    },

    // Query và mutation
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
