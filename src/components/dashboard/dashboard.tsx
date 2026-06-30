"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  ImportExcelMappingDialog,
  EmptyState,
  exportPortfolioToExcel,
  PortfolioTable,
  AddCaseDialog,
} from "@/components/portfolio";
import { SummaryCards } from "./summary-cards";
import { FadeIn } from "@/components/ui/animation";
import {
  RecentImportsPopover,
} from "./recent-imports-popover";
import { SteamAccountsCard } from "@/components/steam-accounts";
import { Button } from "@/components/ui/button";

export function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("pending_portfolio_sync") === "true") {
      router.push("/inventory-scanner");
    }
  }, [router]);

  const {
    report,
    loading,
    error,
    setError,
    user,
    googleConfigured,
    dialog: { open: dialogOpen, setOpen: setDialogOpen },
    buff: {
      pricesCny: buffPricesCny,
      cnyToVndRate: buffCnyToVndRate,
      updatePrice: handleUpdateBuffPrice,
      updateRate: handleUpdateBuffRate,
    },
    excel: {
      busy: importBusy,
      status: importStatus,
      rows: excelImportRows,
      setRows: setExcelImportRows,
      fileName: excelFileName,
      inputRef: importInputRef,
      handleFile: handleImportFile,
      handleSource: handleExcelSource,
      handleConfirm: handleConfirmExcelImport,
    },
    mapping: {
      data: mappingDialogData,
      close: closeMappingDialog,
      confirm: confirmMapping,
      templates: savedTemplates,
      deleteTemplate: handleDeleteTemplate,
      suggestedMapping,
    },
    recentImports: { list: recentImports, remove: removeRecentImport },
    table: {
      filteredRows,
      setFilteredRows,
      computedTransactionRows,
      deletingId,
    },
    reportQuery,
    accountsQuery,
    mutations: {
      add: addMutation,
      delete: deleteMutation,
      deleteMany: deleteManyMutation,
      update: updateMutation,
      refresh: refreshMutation,
      import: importMutation,
    },
    t,
  } = useDashboard();

  const steamWalletTotal = useMemo(() => {
    if (!accountsQuery.data) return 0;
    return accountsQuery.data.reduce(
      (sum, acc) => sum + (acc.walletBalanceVnd ?? 0),
      0
    );
  }, [accountsQuery.data]);

  const [isDragOver, setIsDragOver] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && /\.(xlsx|xls|csv)$/i.test(file.name)) {
      await handleExcelSource(file, file.name);
    }
  };

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const text = e.clipboardData?.getData("text/plain");
      if (text && text.includes("\t") && text.includes("\n")) {
        e.preventDefault();
        await handleExcelSource(text, "Clipboard");
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleExcelSource]);

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

      <section
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
      >
        {isDragOver && (
          <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-blue-500/80 bg-[#0c0f17]/90 backdrop-blur-sm">
            <Upload className="mx-auto size-12 text-blue-400 animate-bounce" />
            <p className="mt-4 text-lg font-bold text-stone-100">
              {t("excelMapping.dropFileHere", "Drop Excel file here")}
            </p>
            <p className="mt-1 text-sm text-stone-400">
              {t("excelMapping.pasteHint", "Or copy cells from Excel and press Ctrl+V")}
            </p>
          </div>
        )}
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
              onClick={(e) => {
                if (!googleConfigured || loading || redirecting) {
                  e.preventDefault();
                  return;
                }
                setRedirecting(true);
              }}
              aria-disabled={!googleConfigured || loading || redirecting}
              className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold ${googleConfigured && !loading && !redirecting
                ? "bg-accent text-accent-foreground hover:bg-accent-hover cursor-pointer"
                : "pointer-events-none border border-border text-muted-foreground opacity-50"
                }`}
            >
              {redirecting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogIn className="size-4" />
              )}
              {googleConfigured ? t("auth.loginGmail") : t("auth.missingOAuth")}
            </a>
          </div>
        ) : null}

        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {user && (
            <>
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
                  disabled={loading}
                >
                  <Plus className="size-4" />
                  {t("dashboard.addItem")}
                </Button>
              </div>
            </>
          )}
        </div>

        {error || reportQuery.error ? (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error
              ? t(`auth.errors.${error}`, { defaultValue: error })
              : (reportQuery.error instanceof Error
                ? reportQuery.error.message
                : t("bugReportsAdmin.occurredError"))}
          </div>
        ) : null}

        {user && loading ? <DashboardSkeleton /> : null}

        {!loading && report && user ? (
          <div className="space-y-5">
            <SummaryCards
              computedRows={filteredRows ?? computedTransactionRows}
              steamWalletTotal={steamWalletTotal}
              buffCnyToVndRate={buffCnyToVndRate}
              onUpdateBuffRate={handleUpdateBuffRate}
            />

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

      {mappingDialogData && (
        <ImportExcelMappingDialog
          open={mappingDialogData !== null}
          fileName={mappingDialogData.fileName}
          excelHeaders={mappingDialogData.headers}
          matrix={mappingDialogData.matrix}
          headerRowIndex={mappingDialogData.headerRowIndex}
          suggestedMapping={suggestedMapping}
          savedTemplates={savedTemplates}
          onClose={closeMappingDialog}
          onConfirm={confirmMapping}
          onDeleteTemplate={handleDeleteTemplate}
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
      <div className="rounded-xl border border-stone-800 bg-stone-900/20 p-4 space-y-4">
        {/* Table skeleton replica */}
        <div className="overflow-x-auto rounded-lg border border-stone-850">
          <div className="min-w-full divide-y divide-stone-850">
            {/* Header */}
            <div className="bg-stone-900/50 flex py-3.5 px-4">
              <div className="h-4 w-8 bg-stone-800 animate-pulse rounded mr-6" />
              <div className="h-4 w-40 bg-stone-800 animate-pulse rounded mr-auto" />
              <div className="h-4 w-16 bg-stone-800 animate-pulse rounded mr-12" />
              <div className="h-4 w-24 bg-stone-800 animate-pulse rounded mr-12" />
              <div className="h-4 w-20 bg-stone-800 animate-pulse rounded" />
            </div>
            {/* Rows */}
            <div className="divide-y divide-stone-850 bg-stone-955/20">
              {Array.from({ length: 6 }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex items-center py-4 px-4">
                  <div className="h-4 w-4 bg-stone-800 animate-pulse rounded mr-8" />
                  <div className="flex items-center gap-3 mr-auto">
                    <div className="size-10 bg-stone-800 animate-pulse rounded-lg" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-48 bg-stone-800 animate-pulse rounded" />
                      <div className="h-3 w-24 bg-stone-800 animate-pulse rounded" />
                    </div>
                  </div>
                  <div className="h-4 w-12 bg-stone-800 animate-pulse rounded mr-16" />
                  <div className="h-4.5 w-20 bg-stone-800 animate-pulse rounded mr-16" />
                  <div className="h-4.5 w-24 bg-stone-800 animate-pulse rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
