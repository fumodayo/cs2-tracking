"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calculator,
  Check,
  Clock3,
  Eye,
  FileImage,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import type {
  PostAnalysisDto,
  PostAnalysisHistoryItemDto,
} from "@/types/post-analysis";
import { formatDateTime } from "@/utils/format";
import { formatDateTimeVi as formatHistoryDate } from "@/utils/date";
import { useCurrency } from "@/components/currency-provider";
import { Tooltip } from "@/components/ui/tooltip";
import { CaseThumbnail } from "./case-thumbnail";

import { parseFacebookHtmlSource, extractSteamUrl, buildChatGptPrompt } from "@/utils/facebook-parser";
import { AnalysisResult } from "./components/post-analysis-result";
import { HistoryRow, getHistorySnippet } from "./components/post-analysis-history";
import { Button } from "@/components/ui/button";
import { SlidePanel, SlidePanelContent, SlidePanelTrigger } from "@/components/ui/slide-panel";
import { motion } from "framer-motion";
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
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const [text, setText] = useState(SAMPLE_POST);
  const [analysis, setAnalysis] = useState<PostAnalysisDto | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null,
  );
  const [image, setImage] = useState<UploadedPostImage | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Facebook HTML parsing state variables
  const [activeTab, setActiveTab] = useState<"manual" | "facebook">("manual");
  const [htmlSource, setHtmlSource] = useState("");
  const [extractedData, setExtractedData] = useState<{
    text: string;
    author: string;
    imageUrls: string[];
    postTime?: string;
    authorUrl?: string;
    postUrl?: string;
    steamUrl?: string;
  } | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzingHtml, setIsAnalyzingHtml] = useState(false);
  const [editableText, setEditableText] = useState("");
  const [cacheNotification, setCacheNotification] = useState<{
    message: string;
    item?: PostAnalysisHistoryItemDto;
    isManualMatch?: boolean;
  } | null>(null);
  const [chatGptJsonInput, setChatGptJsonInput] = useState("");
  const [isImportingChatGpt, setIsImportingChatGpt] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

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
      await queryClient.invalidateQueries({
        queryKey: ["post-analysis-history"],
      });
      const nextHistory = await fetchPostAnalysisHistory();

      setAnalysis(nextAnalysis);
      setSelectedHistoryId(nextHistory[0]?.id ?? null);
      setError(null);

      if (nextAnalysis.cacheStatus === "hit") {
        const matchingItem = nextHistory.find(
          (h) =>
            h.analysis.totalSteamValue === nextAnalysis.totalSteamValue &&
            h.text === text,
        );
        setCacheNotification({
          message: `Bài viết trùng khớp với lịch sử phân tích. Đã tự động tải nhanh kết quả từ cơ sở dữ liệu!`,
          item: matchingItem,
          isManualMatch: true,
        });
      } else {
        setCacheNotification(null);
      }
    },
    onError: (analyzeError) => {
      setAnalysis(null);
      setSelectedHistoryId(null);
      setError(
        analyzeError instanceof Error
          ? analyzeError.message
          : "Không thể phân tích bài viết.",
      );
      setCacheNotification(null);
    },
  });

  const deleteHistoryMutation = useMutation({
    mutationFn: deletePostAnalysisHistoryItem,
    onSuccess: async (_result, id) => {
      await queryClient.invalidateQueries({
        queryKey: ["post-analysis-history"],
      });
      if (selectedHistoryId === id) {
        setSelectedHistoryId(null);
      }
      setCacheNotification(null);
    },
    onError: (deleteError) => {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Không thể xóa lịch sử phân tích.",
      );
    },
  });

  const selectedHistory = useMemo(
    () => history.find((item) => item.id === selectedHistoryId) ?? null,
    [history, selectedHistoryId],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCacheNotification(null);
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

  async function handlePaste(event: React.ClipboardEvent<HTMLFormElement>) {
    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          await processImageFile(file);
          break;
        }
      }
    }
  }

  function clearImage() {
    setImage(null);
  }

  function loadHistoryItem(item: PostAnalysisHistoryItemDto) {
    setText(item.text);
    setAnalysis({
      ...item.analysis,
      imageCloudinaryUrl:
        item.analysis.imageCloudinaryUrl ?? item.imageCloudinaryUrl,
    });
    setImage(null);
    setSelectedHistoryId(item.id);
    setError(null);
    setCacheNotification(null);
    setHistoryOpen(false);
  }

  function deleteHistoryItem(id: string) {
    deleteHistoryMutation.mutate(id);
  }

  async function handleExtractHtml(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!htmlSource.trim()) return;

    setIsExtracting(true);
    setError(null);
    setExtractedData(null);
    setSelectedImages([]);

    // Schedule processing on next frame to ensure the UI renders the loading spinner
    setTimeout(() => {
      try {
        const extracted = parseFacebookHtmlSource(htmlSource);
        setExtractedData(extracted);
        setEditableText(extracted.text);

        if (extracted.imageUrls.length > 0) {
          setSelectedImages(extracted.imageUrls);
        }

        const postUrl = extracted.postUrl;
        // Automatic Duplicate Check
        if (postUrl) {
          fetch(`/api/post/history?postUrl=${encodeURIComponent(postUrl)}`)
            .then((res) => res.json())
            .then((data) => {
              if (data.item) {
                const historyItem = data.item;
                setAnalysis({
                  ...historyItem.analysis,
                  imageCloudinaryUrl:
                    historyItem.analysis.imageCloudinaryUrl ??
                    historyItem.imageCloudinaryUrl,
                  cacheStatus: "hit",
                });
                setSelectedHistoryId(historyItem.id);
                setCacheNotification({
                  message: `Bài viết này đã được phân tích trước đó vào lúc ${formatHistoryDate(historyItem.updatedAt)}. Kết quả cũ đã được tự động hiển thị để tối ưu hóa!`,
                  item: historyItem,
                });
              }
            })
            .catch((e) =>
              console.error("Lỗi khi kiểm tra trùng lặp lịch sử bài viết:", e),
            );
        }
      } catch (err) {
        console.error("Client-side extraction failed:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Đã xảy ra lỗi khi trích xuất mã nguồn.",
        );
      } finally {
        setIsExtracting(false);
      }
    }, 50);
  }

  async function handleAnalyzeHtml(
    event: React.FormEvent<HTMLFormElement> | null,
    force = false,
  ) {
    if (event) event.preventDefault();
    if (!editableText.trim()) return;

    setIsAnalyzingHtml(true);
    setError(null);
    setCacheNotification(null);

    try {
      const response = await fetch("/api/post/analyze-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: editableText,
          imageUrls: selectedImages,
          author: extractedData?.author,
          postTime: extractedData?.postTime,
          authorUrl: extractedData?.authorUrl,
          postUrl: extractedData?.postUrl,
          steamUrl:
            extractedData?.steamUrl ||
            extractSteamUrl(editableText) ||
            undefined,
          force,
        }),
      });

      const nextAnalysis = await response.json();
      if (!response.ok) {
        throw new Error(nextAnalysis.message ?? "Không thể phân tích giá.");
      }

      await queryClient.invalidateQueries({
        queryKey: ["post-analysis-history"],
      });
      const nextHistory = await fetchPostAnalysisHistory();

      setAnalysis(nextAnalysis);
      setSelectedHistoryId(nextHistory[0]?.id ?? null);

      if (nextAnalysis.cacheStatus === "hit") {
        const matchingItem = nextHistory.find(
          (h) =>
            h.id === nextHistory[0]?.id ||
            h.analysis.totalSteamValue === nextAnalysis.totalSteamValue,
        );
        setCacheNotification({
          message: `Bài viết đã được phân tích trước đó. Đã tự động tải nhanh kết quả từ cơ sở dữ liệu!`,
          item: matchingItem,
        });
      } else {
        setCacheNotification(null);
        setExtractedData(null);
        setHtmlSource("");
        setSelectedImages([]);
      }
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Đã xảy ra lỗi khi phân tích.",
      );
    } finally {
      setIsAnalyzingHtml(false);
    }
  }

  async function handleImportChatGptJson(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!chatGptJsonInput.trim()) return;

    setIsImportingChatGpt(true);
    setError(null);
    setCacheNotification(null);

    try {
      const trimmedInput = chatGptJsonInput.trim();
      let parsedJson: any = null;

      try {
        parsedJson = JSON.parse(trimmedInput);
      } catch {
        // Try extracting markdown JSON fence: ```json ... ``` or ``` ... ```
        const markdownMatch = trimmedInput.match(
          /```(?:json)?\s*([\s\S]*?)```/,
        );
        if (markdownMatch && markdownMatch[1]) {
          try {
            parsedJson = JSON.parse(markdownMatch[1].trim());
          } catch {
            // continue
          }
        }

        // If not resolved, try matching first { ... } block
        if (!parsedJson) {
          const curlyMatch = trimmedInput.match(/\{[\s\S]*\}/);
          if (curlyMatch && curlyMatch[0]) {
            try {
              parsedJson = JSON.parse(curlyMatch[0].trim());
            } catch {
              // continue
            }
          }
        }
      }

      if (!parsedJson || typeof parsedJson !== "object") {
        throw new Error(
          "Không nhận dạng được dữ liệu JSON hợp lệ. Bạn hãy chắc chắn đã copy toàn bộ câu trả lời có định dạng JSON từ Gemini Web.",
        );
      }

      const response = await fetch("/api/post/analyze-chatgpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: activeTab === "facebook" ? editableText : text,
          chatGptJson: parsedJson,
          author: extractedData?.author,
          postTime: extractedData?.postTime,
          authorUrl: extractedData?.authorUrl,
          postUrl: extractedData?.postUrl,
          steamUrl:
            extractedData?.steamUrl ||
            extractSteamUrl(activeTab === "facebook" ? editableText : text) ||
            undefined,
        }),
      });

      const nextAnalysis = await response.json();
      if (!response.ok) {
        throw new Error(
          nextAnalysis.message ?? "Không thể phân tích dữ liệu từ Gemini.",
        );
      }

      await queryClient.invalidateQueries({
        queryKey: ["post-analysis-history"],
      });
      const nextHistory = await fetchPostAnalysisHistory();

      setAnalysis(nextAnalysis);
      setSelectedHistoryId(nextHistory[0]?.id ?? null);
      setChatGptJsonInput("");
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Dữ liệu JSON không hợp lệ.",
      );
    } finally {
      setIsImportingChatGpt(false);
    }
  }

  function toggleImageSelection(url: string) {
    setSelectedImages((prev) => {
      if (prev.includes(url)) {
        return prev.filter((item) => item !== url);
      } else {
        return [...prev, url];
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-stone-800 bg-stone-950/25 p-6 shadow-sm">
        {/* Top bar with tabs and history */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-850 pb-5 mb-6">
          {/* Tab Selector */}
          <div className="relative inline-flex h-10 items-center rounded-lg border border-stone-800 bg-stone-950 p-1 shadow-inner select-none shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab("manual");
                setError(null);
                setCacheNotification(null);
              }}
              className={`relative inline-flex items-center justify-center rounded px-4 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer h-8 ${
                activeTab === "manual"
                  ? "text-slate-950 font-extrabold"
                  : "text-stone-400 hover:text-stone-200"
              }`}
            >
              {activeTab === "manual" && (
                <motion.div
                  layoutId="postAnalyzerActiveTab"
                  className="absolute inset-0 rounded bg-accent shadow-md shadow-blue-500/25"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">Nhập thủ công</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("facebook");
                setError(null);
                setCacheNotification(null);
              }}
              className={`relative inline-flex items-center justify-center rounded px-4 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer h-8 ${
                activeTab === "facebook"
                  ? "text-slate-950 font-extrabold"
                  : "text-stone-400 hover:text-stone-200"
              }`}
            >
              {activeTab === "facebook" && (
                <motion.div
                  layoutId="postAnalyzerActiveTab"
                  className="absolute inset-0 rounded bg-accent shadow-md shadow-blue-500/25"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">Trích xuất Facebook (Ctrl + U)</span>
            </button>
          </div>

          {/* History Slide Panel */}
          <SlidePanel open={historyOpen} onOpenChange={setHistoryOpen}>
            <SlidePanelTrigger asChild>
              <Button
                variant="outline"
                className="inline-flex h-10 items-center justify-center gap-2 px-4 text-xs font-semibold cursor-pointer shadow-sm hover:border-stone-700"
              >
                <Clock3 className="size-4 text-blue-400" />
                <span>Lịch sử phân tích ({history.length})</span>
              </Button>
            </SlidePanelTrigger>
            <SlidePanelContent
              title="Lịch sử phân tích"
              description={`${history.length} bài viết đã được lưu trong MongoDB`}
            >
              {historyQuery.isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-stone-500">
                  <Loader2 className="size-6 animate-spin text-blue-400 mb-2" />
                  <span>Đang tải lịch sử...</span>
                </div>
              ) : history.length === 0 ? (
                <div className="rounded-md border border-dashed border-stone-800 px-4 py-8 text-center text-sm text-stone-500">
                  Chưa có bài nào được lưu.
                </div>
              ) : (
                <div className="space-y-3 pr-1">
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
            </SlidePanelContent>
          </SlidePanel>
        </div>

        {activeTab === "manual" ? (
          <form
            onSubmit={handleSubmit}
            onPaste={handlePaste}
            className="space-y-4 animate-fade-slide-in"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider block">
                Bài viết cần phân tích
              </label>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={7}
                placeholder="Dán nội dung bài viết cần tính giá tại đây..."
                className="w-full resize-y rounded-lg border border-stone-800 bg-stone-950/40 p-4 text-sm leading-relaxed text-stone-100 outline-none transition-all focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 placeholder:text-stone-700"
              />
            </div>
            <div
              onDragOver={handleImageDragOver}
              onDragLeave={handleImageDragLeave}
              onDrop={handleImageDrop}
              className={`rounded-xl border border-dashed p-4 transition-all duration-200 ${
                isDraggingImage
                  ? "border-blue-500 bg-blue-500/[0.02] scale-[1.01]"
                  : "border-stone-800 bg-stone-950/20 hover:border-stone-700 hover:bg-stone-950/30"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-stone-300 uppercase tracking-wider">
                    <FileImage className="size-4 text-blue-400" />
                    Ảnh inventory
                  </div>
                  <p className="mt-1.5 text-xs text-stone-500 leading-relaxed max-w-xl">
                    Kéo thả ảnh chụp màn hình hòm đồ/skin vào đây hoặc click chọn ảnh. AI sẽ ưu tiên đếm số lượng trực tiếp từ ảnh.
                  </p>
                </div>
                <label className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-stone-800 bg-stone-900/60 px-3.5 text-xs font-semibold text-stone-300 hover:bg-stone-800 hover:text-stone-200 hover:border-stone-700 transition-all cursor-pointer">
                  <FileImage className="size-3.5 text-blue-400" />
                  Tải ảnh
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={handleImageChange}
                  />
                </label>
              </div>

              {image ? (
                <div className="mt-4 flex items-start gap-4 rounded-lg border border-stone-800 bg-stone-950/60 p-3">
                  <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded border border-stone-800 bg-stone-900">
                    <Image
                      src={image.previewUrl}
                      alt={image.fileName}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1 py-1">
                    <div className="truncate text-sm font-semibold text-stone-200">
                      {image.fileName}
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      Ảnh đã sẵn sàng. AI sẽ quét ảnh này khi bạn nhấn Phân tích.
                    </p>
                  </div>
                  <Tooltip content="Gỡ bỏ ảnh">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={clearImage}
                      className="size-8 rounded-lg border border-stone-800 bg-stone-900/40 text-stone-400 hover:border-red-500/30 hover:bg-red-950/30 hover:text-red-400 transition-colors"
                    >
                      <X className="size-4" />
                    </Button>
                  </Tooltip>
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-stone-800/65 pt-4">
              <p className="text-xs text-stone-505">
                {selectedHistory
                  ? `Đang xem lại bài đã lưu: ${formatHistoryDate(selectedHistory.createdAt)}`
                  : "Kết quả mới sẽ tự động lưu vào cơ sở dữ liệu."}
              </p>
              <Button
                type="submit"
                disabled={analyzeMutation.isPending || (!text.trim() && !image)}
                variant="primary"
                className="inline-flex h-10 items-center justify-center gap-1.5 px-5 text-xs font-bold cursor-pointer"
              >
                {analyzeMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Calculator className="size-3.5" />
                )}
                <span>Phân tích giá</span>
              </Button>
            </div>
          </form>
        ) : !extractedData ? (
          <form onSubmit={handleExtractHtml} className="space-y-5 animate-fade-slide-in">
            <div className="rounded-xl border border-blue-500/10 bg-blue-500/[0.02] p-4 text-xs leading-relaxed text-blue-300">
              <span className="mb-2 block flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-200">
                💡 Hướng dẫn lấy mã nguồn bài viết Facebook:
              </span>
              <ol className="list-decimal space-y-2 pl-4 text-stone-400">
                <li>
                  Nhấp chuột vào <strong>mốc thời gian</strong> hiển thị của bài viết Facebook để mở bài viết ở một tab riêng biệt.
                </li>
                <li>
                  Nhấn tổ hợp phím{" "}
                  <kbd className="border-stone-800 rounded border bg-stone-900 px-1 py-0.5 font-mono text-[10px] text-white">
                    Ctrl + U
                  </kbd>{" "}
                  (hoặc nhấp chuột phải và chọn <strong>Xem nguồn trang</strong>).
                </li>
                <li>
                  Nhấn{" "}
                  <kbd className="border-stone-800 rounded border bg-stone-900 px-1 py-0.5 font-mono text-[10px] text-white">
                    Ctrl + A
                  </kbd>{" "}
                  để chọn toàn bộ nội dung mã nguồn, sau đó nhấn{" "}
                  <kbd className="border-stone-800 rounded border bg-stone-900 px-1 py-0.5 font-mono text-[10px] text-white">
                    Ctrl + C
                  </kbd>{" "}
                  để sao chép.
                </li>
                <li>
                  Dán (
                  <kbd className="border-stone-800 rounded border bg-stone-900 px-1 py-0.5 font-mono text-[10px] text-white">
                    Ctrl + V
                  </kbd>
                  ) toàn bộ mã nguồn vừa copy vào khung nhập bên dưới.
                </li>
              </ol>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider block">
                Mã nguồn HTML trang bài viết (Ctrl + U)
              </label>
              <textarea
                value={htmlSource}
                onChange={(event) => setHtmlSource(event.target.value)}
                rows={9}
                placeholder="Dán toàn bộ mã nguồn trang bài viết Facebook tại đây..."
                className="w-full resize-y rounded-lg border border-stone-800 bg-stone-950/40 p-4 font-mono text-xs text-stone-100 outline-none transition-all focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 placeholder:text-stone-700"
              />
            </div>

            {htmlSource.trim() &&
              (htmlSource.trim().startsWith("http://") ||
                htmlSource.trim().startsWith("https://") ||
                htmlSource.trim().includes("facebook.com")) && (
                <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.02] p-4 text-xs text-amber-300">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-amber-200">
                    ⚠️ Phát hiện liên kết trực tiếp (URL)
                  </span>
                  Bạn vừa nhập đường dẫn trực tiếp của bài viết. Vì đây là bài viết trong nhóm kín, hệ thống không thể trực tiếp cào dữ liệu qua URL mà không có phiên đăng nhập của bạn.
                  <br />
                  Vui lòng nhấn{" "}
                  <kbd className="border-stone-800 rounded border bg-stone-900 px-1 py-0.5 font-mono text-[10px] text-white">
                    Ctrl + U
                  </kbd>{" "}
                  tại trang bài đăng, copy tất cả và dán vào đây.
                </div>
              )}

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={isExtracting || !htmlSource.trim()}
                variant="primary"
                className="inline-flex h-10 items-center justify-center gap-1.5 px-5 text-xs font-bold cursor-pointer"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Đang trích xuất...</span>
                  </>
                ) : (
                  <>
                    <Eye className="size-4" />
                    <span>Trích xuất thông tin</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleAnalyzeHtml} className="space-y-5 animate-fade-slide-in">
            <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.02] p-4 text-xs text-emerald-300 flex items-center gap-2">
              <Check className="size-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Trích xuất dữ liệu bài viết thành công!</strong> Hãy chọn ảnh kho đồ và chỉnh sửa lại nội dung nếu cần trước khi phân tích.
              </span>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-stone-800 bg-stone-950/20 p-4 text-xs text-stone-400 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col flex-wrap gap-3 sm:flex-row sm:items-center sm:gap-6">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Người đăng bài</span>
                  {extractedData.authorUrl ? (
                    <a
                      href={extractedData.authorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {extractedData.author}
                    </a>
                  ) : (
                    <strong className="text-stone-200">
                      {extractedData.author}
                    </strong>
                  )}
                </div>
                {extractedData.postTime && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Thời gian đăng</span>
                    {extractedData.postUrl ? (
                      <a
                        href={extractedData.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-stone-300 hover:text-stone-200 transition-colors font-medium"
                      >
                        {extractedData.postTime}
                      </a>
                    ) : (
                      <strong className="text-stone-200">
                        {extractedData.postTime}
                      </strong>
                    )}
                  </div>
                )}
                {extractedData.steamUrl && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Steam Inventory Link</span>
                    <a
                      href={extractedData.steamUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      {extractedData.steamUrl}
                    </a>
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setExtractedData(null);
                  setHtmlSource("");
                  setSelectedImages([]);
                  setError(null);
                  setCacheNotification(null);
                }}
                className="h-8 text-[11px] font-semibold border-stone-850 hover:bg-stone-900"
              >
                Quay lại / Dán nguồn khác
              </Button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider block">
                Nội dung bài viết (Có thể chỉnh sửa lại nếu cần)
              </label>
              <textarea
                value={editableText}
                onChange={(event) => setEditableText(event.target.value)}
                rows={7}
                className="w-full resize-y rounded-lg border border-stone-800 bg-stone-950/40 p-4 text-sm leading-relaxed text-stone-100 outline-none transition-all focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider block">
                Chọn ảnh chụp kho đồ từ bài đăng ({selectedImages.length}/{extractedData.imageUrls.length})
              </span>

              {extractedData.imageUrls.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-800 p-8 text-center text-xs text-stone-500">
                  Không tìm thấy hình ảnh đính kèm nào khả dụng trong mã nguồn bài viết.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 max-h-[18rem] overflow-y-auto rounded-xl border border-stone-855 bg-stone-950/40 p-3 scrollbar-thin">
                  {extractedData.imageUrls.map((url, idx) => {
                    const isSelected = selectedImages.includes(url);
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleImageSelection(url)}
                        className={`group relative aspect-[4/3] cursor-pointer overflow-hidden rounded-lg border bg-stone-900 transition-all duration-200 ${
                          isSelected
                            ? "border-blue-500 ring-2 ring-blue-500/25 scale-[0.98]"
                            : "border-stone-800 hover:border-stone-700 hover:scale-[1.01]"
                        }`}
                      >
                        <img
                          src={url}
                          alt={`fb-post-img-${idx}`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <div
                          className={`absolute top-2 right-2 flex size-5 items-center justify-center rounded-full transition-all duration-150 ${
                            isSelected
                              ? "bg-blue-500 text-slate-950 scale-100 opacity-100"
                              : "border border-stone-600 bg-black/60 text-transparent scale-75 opacity-0 group-hover:opacity-100 group-hover:scale-100"
                          }`}
                        >
                          <Check className="size-3 stroke-[3px]" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] leading-relaxed text-stone-500">
                * Click để chọn/bỏ chọn các ảnh từ bài đăng (mặc định đã chọn tất cả). AI sẽ ưu tiên trích xuất và đếm số lượng vật phẩm từ các hình ảnh được chọn này.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-stone-800/65">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setExtractedData(null);
                  setSelectedImages([]);
                  setError(null);
                  setCacheNotification(null);
                }}
                className="h-10 px-5 text-xs font-semibold border-stone-850 hover:bg-stone-900"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={isAnalyzingHtml || !editableText.trim()}
                variant="primary"
                className="inline-flex h-10 items-center justify-center gap-1.5 px-5 text-xs font-bold cursor-pointer"
              >
                {isAnalyzingHtml ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Đang phân tích...</span>
                  </>
                ) : (
                  <>
                    <Calculator className="size-3.5" />
                    <span>Phân tích giá</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {error || historyErrorMessage ? (
          <div className="mt-4 rounded-lg border border-red-500/10 bg-red-500/[0.02] px-4 py-3 text-xs text-red-400">
            {error ?? historyErrorMessage}
          </div>
        ) : null}

        {error &&
        (error.toLowerCase().includes("quota") ||
          error.toLowerCase().includes("gemini") ||
          error.toLowerCase().includes("billing")) ? (
          <div className="mt-5 space-y-4 rounded-xl border border-amber-500/15 bg-amber-500/[0.02] p-5 animate-fade-slide-in">
            <div className="flex items-start gap-2.5">
              <span className="text-sm font-bold uppercase tracking-wider text-amber-200 flex items-center gap-1.5">
                ⚠️ Khắc phục lỗi hạn ngạch (Quota) Gemini
              </span>
            </div>
            <p className="text-xs leading-relaxed text-stone-400">
              Khóa API Gemini của bạn tạm thời hết số lượt gọi miễn phí hoặc chưa được kích hoạt tính năng thanh toán. Bạn có thể tự phân tích qua giao diện Gemini Web bằng cách sao chép Prompt & dán kết quả JSON trở lại đây:
            </p>

            <div className="group relative rounded-lg border border-stone-850 bg-stone-950/60 p-3">
              <textarea
                readOnly
                value={buildChatGptPrompt(
                  activeTab === "facebook" ? editableText : text,
                  activeTab === "facebook"
                    ? selectedImages
                    : image
                      ? [image.previewUrl]
                      : [],
                )}
                rows={5}
                className="w-full resize-none bg-transparent font-mono text-[11px] leading-relaxed text-stone-400 focus:outline-none scrollbar-thin"
              />
              <div className="absolute right-3 bottom-3 flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 px-3 text-[11px] font-bold"
                  onClick={() => {
                    const promptText = buildChatGptPrompt(
                      activeTab === "facebook" ? editableText : text,
                      activeTab === "facebook"
                        ? selectedImages
                        : image
                          ? [image.previewUrl]
                          : [],
                    );
                    navigator.clipboard.writeText(promptText);
                    alert("Đã sao chép Prompt vào Clipboard!");
                  }}
                >
                  Sao chép Prompt
                </Button>
                <a
                  href="https://gemini.google.com/app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center justify-center rounded-md bg-accent hover:bg-accent-hover px-3 text-[11px] font-bold text-slate-950 transition-all cursor-pointer"
                >
                  Mở Gemini Web ↗
                </a>
              </div>
            </div>

            <form
              onSubmit={handleImportChatGptJson}
              className="border-stone-800 space-y-2 border-t pt-4"
            >
              <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider">
                Nhập kết quả JSON từ Gemini Web để định giá:
                <textarea
                  value={chatGptJsonInput}
                  onChange={(e) => setChatGptJsonInput(e.target.value)}
                  placeholder='Dán đoạn text chứa JSON kết quả của Gemini vào đây...'
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-stone-800 bg-stone-950/40 p-3 font-mono text-xs text-stone-100 outline-none transition-all focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 placeholder:text-stone-700"
                />
              </label>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isImportingChatGpt || !chatGptJsonInput.trim()}
                  variant="primary"
                  className="h-9 px-4 text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                >
                  {isImportingChatGpt ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <Check className="size-4 stroke-[3px]" />
                      Nhập và định giá ngay
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        ) : null}

        {cacheNotification ? (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.02] p-4 text-xs text-emerald-300 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span className="mb-0.5 block font-bold text-emerald-200">
                ⚡ Phát hiện bài trùng khớp trong lịch sử
              </span>
              <p className="leading-relaxed text-stone-450 font-medium">
                {cacheNotification.message}
              </p>
            </div>
            <Button
              type="button"
              disabled={isAnalyzingHtml || analyzeMutation.isPending}
              onClick={() => {
                if (activeTab === "facebook") {
                  void handleAnalyzeHtml(null, true);
                } else {
                  analyzeMutation.mutate({ text, image, force: true });
                }
              }}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-50"
            >
              {isAnalyzingHtml || analyzeMutation.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Calculator className="size-3.5" />
              )}
              Cập nhật giá mới
            </Button>
          </div>
        ) : null}
      </div>

      {analysis ? (
        <div className="rounded-xl border border-stone-800 bg-stone-950/25 p-6 shadow-sm animate-fade-slide-in">
          <h2 className="text-lg font-bold text-stone-50 mb-4 flex items-center gap-2.5">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            Kết quả phân tích chi tiết
          </h2>
          <AnalysisResult analysis={analysis} />
        </div>
      ) : null}
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
    reader.onerror = () =>
      reject(reader.error ?? new Error("Cannot read file"));
    reader.readAsDataURL(file);
  });
}

async function fetchPostAnalysisHistory(): Promise<
  PostAnalysisHistoryItemDto[]
> {
  const response = await fetch("/api/post/history", { cache: "no-store" });
  const data = (await response.json()) as {
    items?: PostAnalysisHistoryItemDto[];
    message?: string;
  };

  if (!response.ok) {
    throw new Error(data.message ?? "Không thể tải lịch sử phân tích.");
  }

  return Array.isArray(data.items) ? data.items : [];
}

async function analyzePost({
  text,
  image,
  force,
}: {
  text: string;
  image: UploadedPostImage | null;
  force?: boolean;
}): Promise<PostAnalysisDto> {
  const response = await fetch("/api/post/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      image: image
        ? {
            fileName: image.fileName,
            mimeType: image.mimeType,
            data: image.data,
          }
        : undefined,
      force,
    }),
  });
  const data = (await response.json()) as
    | PostAnalysisDto
    | { message?: string };

  if (!response.ok) {
    throw new Error(
      "message" in data ? data.message : "Không thể phân tích bài viết.",
    );
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

