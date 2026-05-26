"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, RefreshCcw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { PortfolioReportDto } from "@/types/report";
import { AddCaseDialog } from "./add-case-dialog";
import { EmptyState } from "./empty-state";
import { exportPortfolioToExcel, parsePortfolioExcelFile, type PortfolioImportRow } from "./portfolio-excel";
import { PortfolioTable } from "./portfolio-table";
import { SummaryCards } from "./summary-cards";

const PORTFOLIO_QUERY_KEY = ["portfolio-report"];

export function Dashboard() {
  const queryClient = useQueryClient();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportQuery = useQuery({
    queryKey: PORTFOLIO_QUERY_KEY,
    queryFn: fetchPortfolioReport,
  });

  const refreshMutation = useMutation({
    mutationFn: refreshPortfolioPrices,
    onSuccess: (report) => {
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      setError(null);
    },
    onError: setMutationError,
  });

  const addMutation = useMutation({
    mutationFn: addPortfolioItem,
    onSuccess: (report) => {
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      setDialogOpen(false);
      setError(null);
    },
    onError: setMutationError,
  });

  const deleteMutation = useMutation({
    mutationFn: deletePortfolioItem,
    onSuccess: (report) => {
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      setError(null);
    },
    onError: setMutationError,
  });

  const importMutation = useMutation({
    mutationFn: importPortfolioRows,
    onSuccess: (report) => {
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      setError(null);
    },
    onError: setMutationError,
  });

  const report = reportQuery.data ?? null;
  const loading = reportQuery.isLoading;
  const deletingId = deleteMutation.isPending ? deleteMutation.variables ?? null : null;

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
      const rows = await parsePortfolioExcelFile(file);
      importMutation.mutate(rows);
    } catch (importError) {
      setError(getErrorMessage(importError));
    }
  }

  return (
    <main className="min-h-screen">
      <section className="relative min-h-[21rem] overflow-hidden border-b border-stone-800">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{ backgroundImage: "url('/assets/dashboard-banner.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0e0f0f] via-[#0e0f0f]/84 to-[#0e0f0f]/20" />
        <div className="relative mx-auto flex max-w-7xl flex-col justify-end px-4 pb-8 pt-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">CS2 Portfolio Tracker</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal text-stone-50 sm:text-5xl">
              Theo dõi lời lỗ case đã mua
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-300">
              Nhập giá mua và số lượng case, dashboard sẽ so sánh với giá hiện tại và lưu snapshot để tính biến động
              7 ngày, 1 tháng, 3 tháng, 6 tháng, 1 năm.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-stone-50">Portfolio</h2>
            <p className="mt-1 text-sm text-stone-400">
              Giá hiện tại được cache ngắn hạn, lịch sử lưu MongoDB, bảng hỗ trợ tìm kiếm, sắp xếp và tổng hợp case.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending || loading}
              className="inline-flex items-center gap-2 rounded-md border border-stone-700 px-3 py-2 text-sm font-medium text-stone-200 hover:bg-stone-800 disabled:cursor-wait disabled:opacity-50"
            >
              <RefreshCcw className={`size-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              Refresh giá
            </button>
            <button
              type="button"
              onClick={() => report && exportPortfolioToExcel(report)}
              disabled={!report || report.rows.length === 0}
              className="inline-flex items-center gap-2 rounded-md border border-stone-700 px-3 py-2 text-sm font-medium text-stone-200 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="size-4" />
              Xuất Excel
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={importMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-stone-700 px-3 py-2 text-sm font-medium text-stone-200 hover:bg-stone-800 disabled:cursor-wait disabled:opacity-50"
            >
              <Upload className="size-4" />
              {importMutation.isPending ? "Đang import..." : "Nhập Excel"}
            </button>
            <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={handleImportFile} />
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950 hover:bg-amber-300"
            >
              <Plus className="size-4" />
              Thêm case
            </button>
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
            <SummaryCards report={report} />
            {report.rows.length > 0 ? (
              <PortfolioTable report={report} deletingId={deletingId} onDelete={(id) => deleteMutation.mutate(id)} />
            ) : (
              <EmptyState onAdd={() => setDialogOpen(true)} />
            )}
          </div>
        ) : null}
      </section>

      <footer className="mx-auto max-w-7xl px-4 pb-6 text-xs text-stone-500 sm:px-6 lg:px-8">
        <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer" className="hover:text-stone-300">
          Rates By Exchange Rate API
        </a>
      </footer>

      <AddCaseDialog
        open={dialogOpen}
        saving={addMutation.isPending}
        onClose={() => setDialogOpen(false)}
        onSubmit={(payload) => addMutation.mutateAsync(payload).then(() => undefined)}
      />
    </main>
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

async function importPortfolioRows(rows: PortfolioImportRow[]): Promise<PortfolioReportDto> {
  const response = await fetch("/api/portfolio/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });
  return parseReportResponse(response);
}

async function parseReportResponse(response: Response): Promise<PortfolioReportDto> {
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
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-lg border border-stone-800 bg-stone-900/60" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-lg border border-stone-800 bg-stone-900/60" />
    </div>
  );
}
