"use client";

import { Calculator, Clock3, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PostAnalysisDto } from "@/types/post-analysis";
import { formatCurrency } from "@/utils/format";
import { CaseThumbnail } from "./case-thumbnail";

type AnalysisHistoryItem = {
  id: string;
  createdAt: string;
  text: string;
  analysis: PostAnalysisDto;
};

const HISTORY_STORAGE_KEY = "cs2-post-analysis-history";
const MAX_HISTORY_ITEMS = 30;
const SAMPLE_POST = `Xin phép AD
Em cần bay hết hòm + laptop như trên ảnh ạ
Rate 0.68 mk lấy all 0.65 ạ
x1 dead hand
x6 dream
x4 recoil
x3 revo
x2 fracture`;

export function PostAnalyzer() {
  const [text, setText] = useState(SAMPLE_POST);
  const [analysis, setAnalysis] = useState<PostAnalysisDto | null>(null);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setHistory(readHistory());
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  const selectedHistory = useMemo(
    () => history.find((item) => item.id === selectedHistoryId) ?? null,
    [history, selectedHistoryId],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/post/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await response.json()) as PostAnalysisDto | { message?: string };

      if (!response.ok) {
        throw new Error("message" in data ? data.message : "Không thể phân tích bài viết.");
      }

      const nextAnalysis = data as PostAnalysisDto;
      const historyItem = createHistoryItem(text, nextAnalysis);
      const nextHistory = saveHistoryItem(historyItem, history);

      setAnalysis(nextAnalysis);
      setHistory(nextHistory);
      setSelectedHistoryId(historyItem.id);
    } catch (analyzeError) {
      setAnalysis(null);
      setSelectedHistoryId(null);
      setError(analyzeError instanceof Error ? analyzeError.message : "Không thể phân tích bài viết.");
    } finally {
      setLoading(false);
    }
  }

  function loadHistoryItem(item: AnalysisHistoryItem) {
    setText(item.text);
    setAnalysis(item.analysis);
    setSelectedHistoryId(item.id);
    setError(null);
  }

  function deleteHistoryItem(id: string) {
    const nextHistory = history.filter((item) => item.id !== id);
    writeHistory(nextHistory);
    setHistory(nextHistory);

    if (selectedHistoryId === id) {
      setSelectedHistoryId(null);
    }
  }

  function clearHistory() {
    writeHistory([]);
    setHistory([]);
    setSelectedHistoryId(null);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="rounded-lg border border-stone-800 bg-stone-950/45 p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm font-medium text-stone-200">
            Bài viết cần phân tích
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={9}
              className="mt-2 w-full resize-y rounded-md border border-stone-700 bg-stone-950/70 px-3 py-2 text-sm leading-6 text-stone-100 outline-none focus:border-amber-400"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-stone-500">
              {selectedHistory ? `Đang xem lại bài đã lưu: ${formatHistoryDate(selectedHistory.createdAt)}` : "Kết quả mới sẽ tự lưu vào lịch sử."}
            </p>
            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-amber-400 px-4 text-sm font-semibold text-stone-950 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
              Phân tích giá
            </button>
          </div>
        </form>

        {error ? (
          <div className="mt-4 rounded-md border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {analysis ? <AnalysisResult analysis={analysis} /> : null}
      </section>

      <aside className="rounded-lg border border-stone-800 bg-stone-950/45 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-stone-50">Lịch sử phân tích</h2>
            <p className="mt-1 text-xs text-stone-500">{history.length} bài đã lưu trên trình duyệt này</p>
          </div>
          <button
            type="button"
            onClick={clearHistory}
            disabled={history.length === 0}
            className="inline-flex size-9 items-center justify-center rounded-md border border-stone-700 text-stone-300 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
            title="Xóa toàn bộ lịch sử"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>

        {history.length === 0 ? (
          <div className="rounded-md border border-dashed border-stone-800 px-4 py-8 text-center text-sm text-stone-500">
            Chưa có bài nào được lưu.
          </div>
        ) : (
          <div className="max-h-[44rem] space-y-2 overflow-y-auto pr-1">
            {history.map((item) => (
              <HistoryRow
                key={item.id}
                item={item}
                selected={item.id === selectedHistoryId}
                onLoad={() => loadHistoryItem(item)}
                onDelete={() => deleteHistoryItem(item.id)}
              />
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function HistoryRow({
  item,
  selected,
  onLoad,
  onDelete,
}: {
  item: AnalysisHistoryItem;
  selected: boolean;
  onLoad: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`rounded-md border p-3 ${selected ? "border-amber-400/60 bg-amber-950/20" : "border-stone-800 bg-stone-900/35"}`}>
      <button type="button" onClick={onLoad} className="block w-full text-left">
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <Clock3 className="size-3.5" />
          <span>{formatHistoryDate(item.createdAt)}</span>
        </div>
        <p className="mt-2 line-clamp-3 text-sm leading-5 text-stone-200">{getHistorySnippet(item.text)}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <HistoryMetric label="Case" value={new Intl.NumberFormat("vi-VN").format(item.analysis.totalQuantity)} />
          <HistoryMetric label="Rate" value={item.analysis.allRate.toFixed(2)} />
          <HistoryMetric label="Tổng" value={formatCurrency(item.analysis.totalAllRateValue)} />
        </div>
      </button>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex size-8 items-center justify-center rounded-md border border-stone-700 text-stone-400 hover:border-red-500/50 hover:bg-red-950/30 hover:text-red-200"
          title="Xóa bài này"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

function HistoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded border border-stone-800 bg-stone-950/40 px-2 py-1.5">
      <div className="truncate text-[0.68rem] uppercase tracking-[0.08em] text-stone-500">{label}</div>
      <div className="mt-1 truncate font-semibold text-stone-100">{value}</div>
    </div>
  );
}

function AnalysisResult({ analysis }: { analysis: PostAnalysisDto }) {
  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Rate lẻ" value={analysis.itemRate.toFixed(2)} />
        <Metric label="Rate all" value={analysis.allRate.toFixed(2)} />
        <Metric label="Tổng case" value={new Intl.NumberFormat("vi-VN").format(analysis.totalQuantity)} />
        <Metric label="Tổng lấy all" value={formatCurrency(analysis.totalAllRateValue)} />
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-stone-900/80 text-xs uppercase tracking-[0.12em] text-stone-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Case</th>
                <th className="px-4 py-3 font-semibold">SL</th>
                <th className="px-4 py-3 font-semibold">Giá Steam</th>
                <th className="px-4 py-3 font-semibold">Giá lẻ x rate</th>
                <th className="px-4 py-3 font-semibold">Tổng all rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800">
              {analysis.rows.map((row) => (
                <tr key={row.marketHashName} className="text-stone-200">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CaseThumbnail imageUrl={row.imageUrl} name={row.name} size="sm" />
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-stone-50">{row.name}</div>
                        <div className="truncate text-xs text-stone-500">Từ bài: {row.inputName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{new Intl.NumberFormat("vi-VN").format(row.quantity)}</td>
                  <td className="px-4 py-3">{formatCurrency(row.steamUnitPrice)}</td>
                  <td className="px-4 py-3">{formatCurrency(row.itemRateUnitPrice)}</td>
                  <td className="px-4 py-3 font-semibold text-amber-100">{formatCurrency(row.allRateTotalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Tổng Steam" value={formatCurrency(analysis.totalSteamValue)} />
        <Metric label="Tổng nếu bán lẻ" value={formatCurrency(analysis.totalItemRateValue)} />
        <Metric label="Tổng lấy all" value={formatCurrency(analysis.totalAllRateValue)} />
      </div>

      {analysis.unknownItems.length > 0 ? (
        <div className="rounded-md border border-amber-400/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Chưa nhận diện: {analysis.unknownItems.map((item) => `${item.quantity}x ${item.inputName}`).join(", ")}
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-stone-800 bg-stone-900/45 p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-stone-50">{value}</p>
    </div>
  );
}

function createHistoryItem(text: string, analysis: PostAnalysisDto): AnalysisHistoryItem {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`,
    createdAt: new Date().toISOString(),
    text,
    analysis,
  };
}

function saveHistoryItem(item: AnalysisHistoryItem, currentHistory: AnalysisHistoryItem[]): AnalysisHistoryItem[] {
  const normalizedText = normalizeHistoryText(item.text);
  const dedupedHistory = currentHistory.filter((historyItem) => normalizeHistoryText(historyItem.text) !== normalizedText);
  const nextHistory = [item, ...dedupedHistory].slice(0, MAX_HISTORY_ITEMS);
  writeHistory(nextHistory);
  return nextHistory;
}

function readHistory(): AnalysisHistoryItem[] {
  try {
    const rawValue = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isAnalysisHistoryItem).slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

function writeHistory(history: AnalysisHistoryItem[]) {
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
}

function isAnalysisHistoryItem(value: unknown): value is AnalysisHistoryItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as Partial<AnalysisHistoryItem>;
  return typeof item.id === "string" && typeof item.createdAt === "string" && typeof item.text === "string" && isAnalysis(item.analysis);
}

function isAnalysis(value: unknown): value is PostAnalysisDto {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const analysis = value as Partial<PostAnalysisDto>;
  return (
    typeof analysis.itemRate === "number" &&
    typeof analysis.allRate === "number" &&
    typeof analysis.totalQuantity === "number" &&
    Array.isArray(analysis.rows) &&
    Array.isArray(analysis.unknownItems)
  );
}

function getHistorySnippet(text: string): string {
  return text.replace(/\s+/g, " ").trim() || "Không có nội dung";
}

function normalizeHistoryText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function formatHistoryDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Không rõ thời gian";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
