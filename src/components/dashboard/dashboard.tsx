"use client";

import { Plus, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { PortfolioReportDto } from "@/types/report";
import { AddCaseDialog } from "./add-case-dialog";
import { EmptyState } from "./empty-state";
import { PortfolioTable } from "./portfolio-table";
import { SummaryCards } from "./summary-cards";

export function Dashboard() {
  const [report, setReport] = useState<PortfolioReportDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/portfolio")
      .then(parseReportResponse)
      .then((data) => {
        if (active) {
          setReport(data);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(getErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function refreshPrices() {
    setRefreshing(true);
    setError(null);

    try {
      const response = await fetch("/api/prices/refresh", { method: "POST" });
      const data = await parseReportResponse(response);
      setReport(data);
    } catch (refreshError) {
      setError(getErrorMessage(refreshError));
    } finally {
      setRefreshing(false);
    }
  }

  async function addCase(payload: {
    caseId: string;
    quantity: number;
    buyPrice: number;
    buyDate: string;
    note?: string;
  }) {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseReportResponse(response);
      setReport(data);
      setDialogOpen(false);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
      throw saveError;
    } finally {
      setSaving(false);
    }
  }

  async function deleteCase(id: string) {
    setDeletingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/portfolio/${id}`, { method: "DELETE" });
      const data = await parseReportResponse(response);
      setReport(data);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setDeletingId(null);
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
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-stone-50">Portfolio</h2>
            <p className="mt-1 text-sm text-stone-400">Giá hiện tại được cache ngắn hạn và lưu lịch sử vào MongoDB.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={refreshPrices}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 rounded-md border border-stone-700 px-3 py-2 text-sm font-medium text-stone-200 hover:bg-stone-800 disabled:cursor-wait disabled:opacity-50"
            >
              <RefreshCcw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh giá
            </button>
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

        {error ? (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? <DashboardSkeleton /> : null}

        {!loading && report ? (
          <div className="space-y-5">
            <SummaryCards report={report} />
            {report.rows.length > 0 ? (
              <PortfolioTable rows={report.rows} deletingId={deletingId} onDelete={deleteCase} />
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

      <AddCaseDialog open={dialogOpen} saving={saving} onClose={() => setDialogOpen(false)} onSubmit={addCase} />
    </main>
  );
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
