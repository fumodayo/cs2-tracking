"use client";

import {
  Download,
  LogIn,
  Plus,
  Upload,
  Loader2,
} from "lucide-react";
import { useDashboard } from "./use-dashboard";
import {
  ImportExcelConfirmDialog,
  EmptyState,
  exportPortfolioToExcel,
  PortfolioTable,
} from "@/components/portfolio";
import { SummaryCards } from "./summary-cards";
import { RateCards } from "./rate-cards";
import { FadeIn } from "@/components/ui/animation";
import {
  RecentImportsPopover,
} from "./recent-imports-popover";
import { SteamAccountsCard } from "@/components/steam-accounts";
import { Button } from "@/components/ui/button";
import { AddCaseDialog } from "./add-case-dialog";

export function Dashboard() {
  const {
    report,
    loading,
    error,
    setError,
    dialogOpen,
    setDialogOpen,
    importBusy,
    importStatus,
    recentImports,
    removeRecentImport,
    filteredRows,
    setFilteredRows,
    excelImportRows,
    setExcelImportRows,
    excelFileName,
    user,
    googleConfigured,
    buffPricesCny,
    buffCnyToVndRate,
    handleUpdateBuffPrice,
    handleUpdateBuffRate,
    reportQuery,
    deletingId,
    computedTransactionRows,
    handleImportFile,
    handleConfirmExcelImport,
    importInputRef,
    addMutation,
    deleteMutation,
    deleteManyMutation,
    updateMutation,
    refreshMutation,
    importMutation,
    t,
  } = useDashboard();

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
            {error ?? (reportQuery.error instanceof Error ? reportQuery.error.message : "Có lỗi xảy ra.")}
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
          onConfirm={handleConfirmExcelImport}
        />
      )}
    </div>
  );
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
