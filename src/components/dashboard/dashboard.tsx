"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  LogIn,
  Plus,
  Upload,
  Loader2,
} from "lucide-react";
import { useRef, useState, useMemo } from "react";
import { useSession } from "@/components/auth/use-session";
import type { PortfolioReportDto } from "@/types/report";
import { AddCaseDialog } from "./add-case-dialog";
import {
  ImportExcelConfirmDialog,
  EmptyState,
  exportPortfolioToExcel,
  parsePortfolioExcelFile,
  type PortfolioImportRow,
  PortfolioTable,
  buildPortfolioTableRows,
  type PortfolioTableRow,
} from "@/components/portfolio";
import { SummaryCards } from "./summary-cards";
import { RateCards } from "./rate-cards";
import { FadeIn } from "@/components/ui/animation";
import { useImportStore, importStore, toast, toastStore } from "@/stores";
import {
  RecentImportsPopover,
  useRecentImports,
} from "./recent-imports-popover";
import { useTranslation } from "react-i18next";
import { SteamAccountsCard } from "@/components/steam-accounts";
import { useLocalStorage } from "@/hooks/use-local-storage";

import { Button } from "@/components/ui/button";
const PORTFOLIO_QUERY_KEY = ["portfolio-report"];

type PortfolioImportResponse = PortfolioReportDto & {
  importResult?: {
    importedCount: number;
    importedIds: string[];
  };
};

export function Dashboard() {
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

  const refreshMutation = useMutation({
    mutationFn: async () => {
      // 1. Refresh Steam prices in backend
      const report = await refreshPortfolioPrices();

      // 2. Identify all items that already have a Buff163 price from before
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
              const response = await fetch("/api/inventory/buff-price", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  marketHashName: currentHashName,
                  cnyToVndRate: buffCnyToVndRate,
                  forceRefresh: true, // Fetch fresh and bypass cache
                }),
              });

              if (response.ok) {
                const data = await response.json();
                if (
                  data &&
                  typeof data.priceCny === "number" &&
                  data.priceCny > 0
                ) {
                  newPrices[currentHashName] = data.priceCny;
                }
              }
            } catch (err) {
              // Ignore errors gracefully and continue to keep old price
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
    onMutate: () => {
      const id = toast.loading(t("dashboard.refreshingPrices"));
      return { toastId: id };
    },
    onSuccess: (report, variables, context) => {
      if (context?.toastId) {
        toastStore.update(context.toastId, {
          type: "success",
          title: t("dashboard.refreshSuccess"),
          duration: 4000,
        });
      }
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      setError(null);
    },
    onError: (err, variables, context) => {
      if (context?.toastId) {
        toastStore.update(context.toastId, {
          type: "error",
          title: t("dashboard.refreshError"),
          description: getErrorMessage(err),
          duration: 5000,
        });
      }
      setMutationError(err);
    },
  });

  const addMutation = useMutation({
    mutationFn: addPortfolioItem,
    onMutate: () => {
      const id = toast.loading(t("dashboard.savingItem"));
      return { toastId: id };
    },
    onSuccess: (report, variables, context) => {
      if (context?.toastId) {
        toastStore.update(context.toastId, {
          type: "success",
          title: t("dashboard.itemSaved"),
          duration: 4000,
        });
      }
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      queryClient.invalidateQueries({ queryKey: ["storage_units"] });
      setDialogOpen(false);
      setError(null);
    },
    onError: (err, variables, context) => {
      if (context?.toastId) {
        toastStore.update(context.toastId, {
          type: "error",
          title: t("dashboard.itemSaveError"),
          description: getErrorMessage(err),
          duration: 5000,
        });
      }
      setMutationError(err);
    },
  });

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
      const toastId = toast.loading(t("dashboard.deletingItem"));
      return { previousReport, toastId };
    },
    onSuccess: (report, id, context) => {
      if (context?.toastId) {
        toastStore.update(context.toastId, {
          type: "success",
          title: t("dashboard.itemDeleted"),
          duration: 4000,
        });
      }
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      queryClient.invalidateQueries({ queryKey: ["storage_units"] });
      setError(null);
    },
    onError: (err, id, context) => {
      if (context?.previousReport) {
        queryClient.setQueryData(PORTFOLIO_QUERY_KEY, context.previousReport);
      }
      if (context?.toastId) {
        toastStore.update(context.toastId, {
          type: "error",
          title: t("dashboard.itemDeleteError"),
          description: getErrorMessage(err),
          duration: 5000,
        });
      }
      setMutationError(err);
    },
  });

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
      const toastId = toast.loading(t("dashboard.deletingItems"));
      return { previousReport, toastId };
    },
    onSuccess: (report, ids, context) => {
      if (context?.toastId) {
        toastStore.update(context.toastId, {
          type: "success",
          title: t("dashboard.itemsDeleted"),
          duration: 4000,
        });
      }
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      queryClient.invalidateQueries({ queryKey: ["storage_units"] });
      setError(null);
    },
    onError: (err, ids, context) => {
      if (context?.previousReport) {
        queryClient.setQueryData(PORTFOLIO_QUERY_KEY, context.previousReport);
      }
      if (context?.toastId) {
        toastStore.update(context.toastId, {
          type: "error",
          title: t("dashboard.itemsDeleteError"),
          description: getErrorMessage(err),
          duration: 5000,
        });
      }
      setMutationError(err);
    },
  });

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
      const toastId = toast.loading(t("dashboard.updatingItem"));
      return { previousReport, toastId };
    },
    onSuccess: (report, variables, context) => {
      if (context?.toastId) {
        toastStore.update(context.toastId, {
          type: "success",
          title: t("dashboard.itemUpdated"),
          duration: 4000,
        });
      }
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      queryClient.invalidateQueries({ queryKey: ["storage_units"] });
      setError(null);
    },
    onError: (err, variables, context) => {
      if (context?.previousReport) {
        queryClient.setQueryData(PORTFOLIO_QUERY_KEY, context.previousReport);
      }
      if (context?.toastId) {
        toastStore.update(context.toastId, {
          type: "error",
          title: t("dashboard.itemUpdateError"),
          description: getErrorMessage(err),
          duration: 5000,
        });
      }
      setMutationError(err);
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

  function setMutationError(mutationError: unknown) {
    setError(getErrorMessage(mutationError));
  }

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

  return (
    <div>
      <section className="relative min-h-[21rem] overflow-hidden border-b border-stone-800">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{ backgroundImage: "url('/assets/dashboard-banner.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-hero-scrim via-hero-scrim to-transparent" />
        <div className="relative mx-auto flex max-w-7xl flex-col justify-end px-4 pt-16 pb-8 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold tracking-[0.18em] text-accent uppercase">
              CS2 Portfolio Tracker
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
              {t("dashboard.heroTitle")}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              {t("dashboard.heroDescription")}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {!user ? (
          <div className="mb-5 flex flex-col gap-3 rounded-lg border border-accent/28 bg-accent/12 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-200">
                {t("dashboard.loginPromptTitle")}
              </p>
              <p className="mt-1 text-sm text-stone-300">
                {t("dashboard.loginPromptDesc")}
              </p>
            </div>
            <a
              href="/api/auth/google"
              aria-disabled={!googleConfigured}
              className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold ${
                googleConfigured
                  ? "bg-accent text-accent-foreground hover:bg-accent-hover"
                  : "pointer-events-none border border-border text-muted-foreground"
              }`}
            >
              <LogIn className="size-4" />
              {googleConfigured ? t("auth.loginGmail") : t("auth.missingOAuth")}
            </a>
          </div>
        ) : null}

        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Portfolio
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => report && exportPortfolioToExcel(report)}
              disabled={!report || report.rows.length === 0}
            >
              <Download className="size-4 text-emerald-400" />
              {t("dashboard.exportExcel")}
            </Button>
            <Button
              variant="outline"
              onClick={() => importInputRef.current?.click()}
              disabled={importBusy}
            >
              {importBusy ? (
                <Loader2 className="size-4 animate-spin text-blue-400" />
              ) : (
                <Upload className="size-4 text-blue-400" />
              )}
              {importStatus.phase === "reading"
                ? t("dashboard.readingExcel")
                : importMutation.isPending
                  ? t("dashboard.importing")
                  : t("dashboard.importExcel")}
            </Button>
            <RecentImportsPopover
              recentImports={recentImports}
              onRemove={removeRecentImport}
            />
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={handleImportFile}
            />
            <Button
              variant="primary"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="size-4" />
              {t("dashboard.addItem")}
            </Button>
          </div>
        </div>

        {error || reportQuery.error ? (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error ?? getErrorMessage(reportQuery.error)}
          </div>
        ) : null}

        {loading ? <DashboardSkeleton /> : null}

        {!loading && report ? (
          <div className="space-y-5">
            <SummaryCards
              report={report}
              computedRows={filteredRows ?? computedTransactionRows}
            >
              <RateCards
                rows={filteredRows ?? computedTransactionRows}
                totalInvested={(filteredRows ?? computedTransactionRows).reduce(
                  (sum, r) => sum + r.investedValue,
                  0,
                )}
              />
            </SummaryCards>

            <SteamAccountsCard 
              reportQuery={reportQuery}
              setError={setError}
              buffPricesCny={buffPricesCny}
              buffCnyToVndRate={buffCnyToVndRate}
            />

            {/* Portfolio table — full width */}
            <FadeIn delay={0.32} direction="up">
              {report.rows.length > 0 ? (
                <PortfolioTable
                  report={report}
                  deletingId={deletingId}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onDeleteMany={(ids) =>
                    deleteManyMutation.mutateAsync(ids).then(() => undefined)
                  }
                  isDeletingMany={deleteManyMutation.isPending}
                  updatingId={
                    updateMutation.isPending
                      ? (updateMutation.variables?.id ?? null)
                      : null
                  }
                  onUpdateBuyPrice={(id, buyPrice) =>
                    updateMutation
                      .mutateAsync({ id, buyPrice })
                      .then(() => undefined)
                  }
                  onUpdateQuantity={(id, quantity) =>
                    updateMutation
                      .mutateAsync({ id, quantity })
                      .then(() => undefined)
                  }
                  onUpdateNote={(id, note) =>
                    updateMutation
                      .mutateAsync({ id, note })
                      .then(() => undefined)
                  }
                  onUpdateLot={(id, payload) =>
                    updateMutation
                      .mutateAsync({ id, ...payload })
                      .then(() => undefined)
                  }
                  buffPricesCny={buffPricesCny}
                  buffCnyToVndRate={buffCnyToVndRate}
                  onUpdateBuffPrice={handleUpdateBuffPrice}
                  onAddCaseLot={(payload) =>
                    addMutation.mutateAsync(payload).then(() => undefined)
                  }
                  onRefreshPrices={() => refreshMutation.mutate()}
                  isRefreshingPrices={refreshMutation.isPending || loading}
                  onUpdateBuffRate={handleUpdateBuffRate}
                  onFilteredRowsChange={setFilteredRows}
                />
              ) : (
                <EmptyState onAdd={() => setDialogOpen(true)} />
              )}
            </FadeIn>
          </div>
        ) : null}
      </section>

      <AddCaseDialog
        open={dialogOpen}
        saving={addMutation.isPending}
        onClose={() => setDialogOpen(false)}
        onSubmit={(payload) =>
          addMutation.mutateAsync(payload).then(() => undefined)
        }
        defaultBuffRate={buffCnyToVndRate}
      />

      {excelImportRows && (
        <ImportExcelConfirmDialog
          open={excelImportRows !== null}
          fileName={excelFileName}
          rows={excelImportRows}
          existingItems={
            report?.rows.map((r) => ({
              marketHashName: r.case.marketHashName,
              quantity: r.item.quantity,
            })) ?? []
          }
          onClose={() => setExcelImportRows(null)}
          onConfirm={(confirmedRows) => {
            setExcelImportRows(null);
            if (confirmedRows.length === 0) return;
            importStore.setState({
              phase: "uploading",
              fileName: excelFileName,
              rowsCount: confirmedRows.length,
            });
            importMutation.mutate(confirmedRows);
          }}
        />
      )}

      </div>
  );
}

async function fetchPortfolioReport(): Promise<PortfolioReportDto> {
  const response = await fetch("/api/portfolio", { cache: "no-store" });
  return parseReportResponse(response);
}

async function refreshPortfolioPrices(): Promise<PortfolioReportDto> {
  const response = await fetch("/api/prices/refresh", { method: "POST" });
  return parseReportResponse(response);
}

async function addPortfolioItem(payload: {
  caseId: string;
  quantity: number;
  buyPrice: number;
  buyDate: string;
  note?: string;
  sourceAccounts?: Array<{ steamId64: string; name: string }>;
  storageUnitId?: string;
  tradeHoldUntil?: string | null;
}): Promise<PortfolioReportDto> {
  const response = await fetch("/api/portfolio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseReportResponse(response);
}

async function deletePortfolioItem(id: string): Promise<PortfolioReportDto> {
  const response = await fetch(`/api/portfolio/${id}`, { method: "DELETE" });
  return parseReportResponse(response);
}

async function deleteManyPortfolioItems(
  ids: string[],
): Promise<PortfolioReportDto> {
  const response = await fetch("/api/portfolio", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  return parseReportResponse(response);
}

async function updatePortfolioItem(payload: {
  id: string;
  buyPrice?: number;
  quantity?: number;
  note?: string;
  sourceAccounts?: Array<{ steamId64: string; name: string }>;
  storageUnitId?: string;
  tradeHoldUntil?: string | null;
}): Promise<PortfolioReportDto> {
  const body: Record<string, unknown> = {};
  if (payload.buyPrice !== undefined) body.buyPrice = payload.buyPrice;
  if (payload.quantity !== undefined) body.quantity = payload.quantity;
  if (payload.note !== undefined) body.note = payload.note;
  if (payload.sourceAccounts !== undefined)
    body.sourceAccounts = payload.sourceAccounts;
  if (payload.storageUnitId !== undefined)
    body.storageUnitId = payload.storageUnitId;
  if (payload.tradeHoldUntil !== undefined)
    body.tradeHoldUntil = payload.tradeHoldUntil;

  const response = await fetch(`/api/portfolio/${payload.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseReportResponse(response);
}

async function importPortfolioRows(
  rows: PortfolioImportRow[],
): Promise<PortfolioImportResponse> {
  const response = await fetch("/api/portfolio/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });
  return parseReportResponse(response);
}

async function parseReportResponse(
  response: Response,
): Promise<PortfolioReportDto> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? "Request thất bại.");
  }

  return data as PortfolioReportDto;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Có lỗi xảy ra.";
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-lg border border-stone-800 bg-stone-900/60"
          />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-lg border border-stone-800 bg-stone-900/60" />
    </div>
  );
}
