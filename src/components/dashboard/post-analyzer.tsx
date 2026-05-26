"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Clock3, FileImage, Loader2, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { PostAnalysisDto, PostAnalysisHistoryItemDto } from "@/types/post-analysis";
import { formatCurrency } from "@/utils/format";
import { CaseThumbnail } from "./case-thumbnail";

type UploadedPostImage = {
  fileName: string;
  mimeType: string;
  data: string;
  previewUrl: string;
};

const SAMPLE_POST = `Xin phép AD
Em cần bay hết hòm + laptop như trên ảnh ạ
Rate 0.68 mk lấy all 0.65 ạ
x1 dead hand
x6 dream
x4 recoil
x3 revo
x2 fracture`;

export function PostAnalyzer() {
  const queryClient = useQueryClient();
  const [text, setText] = useState(SAMPLE_POST);
  const [analysis, setAnalysis] = useState<PostAnalysisDto | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [image, setImage] = useState<UploadedPostImage | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const historyQuery = useQuery({
    queryKey: ["post-analysis-history"],
    queryFn: fetchPostAnalysisHistory,
  });

  const history = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);
  const historyErrorMessage = historyQuery.error
    ? historyQuery.error instanceof Error
      ? historyQuery.error.message
      : "Không thể tải lịch sử phân tích."
    : null;

  const analyzeMutation = useMutation({
    mutationFn: analyzePost,
    onSuccess: async (nextAnalysis) => {
      const nextHistory = await queryClient.fetchQuery({
        queryKey: ["post-analysis-history"],
        queryFn: fetchPostAnalysisHistory,
      });

      setAnalysis(nextAnalysis);
      setSelectedHistoryId(nextHistory[0]?.id ?? null);
      setError(null);
    },
    onError: (analyzeError) => {
      setAnalysis(null);
      setSelectedHistoryId(null);
      setError(analyzeError instanceof Error ? analyzeError.message : "Không thể phân tích bài viết.");
    },
  });

  const deleteHistoryMutation = useMutation({
    mutationFn: deletePostAnalysisHistoryItem,
    onSuccess: async (_result, id) => {
      await queryClient.invalidateQueries({ queryKey: ["post-analysis-history"] });
      if (selectedHistoryId === id) {
        setSelectedHistoryId(null);
      }
    },
    onError: (deleteError) => {
      setError(deleteError instanceof Error ? deleteError.message : "Không thể xóa lịch sử phân tích.");
    },
  });

  const selectedHistory = useMemo(
    () => history.find((item) => item.id === selectedHistoryId) ?? null,
    [history, selectedHistoryId],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    analyzeMutation.mutate({ text, image });
  }

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    await processImageFile(file);
  }

  async function processImageFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setIsDraggingImage(false);
    setError(null);

    if (!/^image\/(?:png|jpe?g|webp)$/.test(file.type)) {
      setImage(null);
      setError("Ảnh inventory phải là PNG, JPG hoặc WebP.");
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      setImage(null);
      setError("Ảnh quá lớn. Hãy dùng ảnh dưới khoảng 6MB.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const data = dataUrl.split(",").pop() ?? "";
      setImage({
        fileName: file.name,
        mimeType: file.type,
        data,
        previewUrl: dataUrl,
      });
    } catch {
      setImage(null);
      setError("Không thể đọc ảnh inventory.");
    }
  }

  function handleImageDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingImage(true);
  }

  function handleImageDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDraggingImage(false);
  }

  function handleImageDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingImage(false);
    void processImageFile(event.dataTransfer.files?.[0]);
  }

  function clearImage() {
    setImage(null);
  }

  function loadHistoryItem(item: PostAnalysisHistoryItemDto) {
    setText(item.text);
    setAnalysis(item.analysis);
    setImage(null);
    setSelectedHistoryId(item.id);
    setError(null);
  }

  function deleteHistoryItem(id: string) {
    deleteHistoryMutation.mutate(id);
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
          <div
            onDragOver={handleImageDragOver}
            onDragLeave={handleImageDragLeave}
            onDrop={handleImageDrop}
            className={`rounded-md border border-dashed p-3 transition-colors ${
              isDraggingImage
                ? "border-amber-300 bg-amber-950/25"
                : "border-stone-700 bg-stone-900/35 hover:border-stone-600"
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-stone-200">
                  <FileImage className="size-4 text-amber-300" />
                  Ảnh inventory
                </div>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Kéo thả screenshot kho vào đây hoặc bấm chọn ảnh; khi có ảnh, số lượng hòm sẽ ưu tiên lấy từ ảnh.
                </p>
              </div>
              <label className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-stone-700 px-3 text-sm font-medium text-stone-200 hover:bg-stone-800">
                <FileImage className="size-4" />
                Tải ảnh
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleImageChange} />
              </label>
            </div>

            {image ? (
              <div className="mt-3 flex items-start gap-3 rounded-md border border-stone-800 bg-stone-950/60 p-2">
                <Image
                  src={image.previewUrl}
                  alt={image.fileName}
                  width={64}
                  height={96}
                  unoptimized
                  className="h-24 w-16 shrink-0 rounded border border-stone-800 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-stone-100">{image.fileName}</div>
                  <div className="mt-1 text-xs text-stone-500">Ảnh sẽ được gửi cùng bài viết để nhận diện hòm.</div>
                </div>
                <button
                  type="button"
                  onClick={clearImage}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-stone-700 text-stone-400 hover:border-red-500/50 hover:bg-red-950/30 hover:text-red-200"
                  title="Bỏ ảnh"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-stone-500">
              {selectedHistory ? `Đang xem lại bài đã lưu: ${formatHistoryDate(selectedHistory.createdAt)}` : "Kết quả mới sẽ tự lưu vào lịch sử."}
            </p>
            <button
              type="submit"
              disabled={analyzeMutation.isPending || (!text.trim() && !image)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-amber-400 px-4 text-sm font-semibold text-stone-950 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-50"
            >
              {analyzeMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
              Phân tích giá
            </button>
          </div>
        </form>

        {error || historyErrorMessage ? (
          <div className="mt-4 rounded-md border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error ?? historyErrorMessage}
          </div>
        ) : null}

        {analysis ? <AnalysisResult analysis={analysis} /> : null}
      </section>

      <aside className="rounded-lg border border-stone-800 bg-stone-950/45 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-stone-50">Lịch sử phân tích</h2>
            <p className="mt-1 text-xs text-stone-500">{history.length} bài đã lưu trong MongoDB</p>
          </div>
        </div>

        {historyQuery.isLoading ? (
          <div className="rounded-md border border-dashed border-stone-800 px-4 py-8 text-center text-sm text-stone-500">
            Đang tải lịch sử...
          </div>
        ) : history.length === 0 ? (
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
  item: PostAnalysisHistoryItemDto;
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
        {item.imageFileName ? <p className="mt-1 truncate text-xs text-stone-500">Ảnh: {item.imageFileName}</p> : null}
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
      <p className="text-xs text-stone-500">
        Nguồn số lượng: {analysis.itemSource === "image" ? "ảnh inventory upload" : "nội dung bài viết"}
        {analysis.cacheStatus === "hit" ? " · Dùng lại kết quả đã lưu, không phân tích lại" : null}
      </p>

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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Invalid file result"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Cannot read file"));
    reader.readAsDataURL(file);
  });
}

async function fetchPostAnalysisHistory(): Promise<PostAnalysisHistoryItemDto[]> {
  const response = await fetch("/api/post/history", { cache: "no-store" });
  const data = (await response.json()) as { items?: PostAnalysisHistoryItemDto[]; message?: string };

  if (!response.ok) {
    throw new Error(data.message ?? "Không thể tải lịch sử phân tích.");
  }

  return Array.isArray(data.items) ? data.items : [];
}

async function analyzePost({
  text,
  image,
}: {
  text: string;
  image: UploadedPostImage | null;
}): Promise<PostAnalysisDto> {
  const response = await fetch("/api/post/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      image: image ? { fileName: image.fileName, mimeType: image.mimeType, data: image.data } : undefined,
    }),
  });
  const data = (await response.json()) as PostAnalysisDto | { message?: string };

  if (!response.ok) {
    throw new Error("message" in data ? data.message : "Không thể phân tích bài viết.");
  }

  return data as PostAnalysisDto;
}

async function deletePostAnalysisHistoryItem(id: string): Promise<void> {
  const response = await fetch(`/api/post/history/${id}`, { method: "DELETE" });
  const data = (await response.json()) as { message?: string };

  if (!response.ok) {
    throw new Error(data.message ?? "Không thể xóa lịch sử phân tích.");
  }
}

function getHistorySnippet(text: string): string {
  return text.replace(/\s+/g, " ").trim() || "Không có nội dung";
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
