"use client";

import type React from "react";
import { Calculator, Check, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PostAnalysisHistoryItemDto } from "@/types/post-analysis";

interface FacebookTabProps {
  htmlSource: string;
  setHtmlSource: (val: string) => void;
  extractedData: {
    text: string;
    author: string;
    imageUrls: string[];
    postTime?: string;
    authorUrl?: string;
    postUrl?: string;
    steamUrl?: string;
  } | null;
  setExtractedData: (val: {
    text: string;
    author: string;
    imageUrls: string[];
    postTime?: string;
    authorUrl?: string;
    postUrl?: string;
    steamUrl?: string;
  } | null) => void;
  selectedImages: string[];
  setSelectedImages: (val: string[] | ((prev: string[]) => string[])) => void;
  isExtracting: boolean;
  isAnalyzingHtml: boolean;
  editableText: string;
  setEditableText: (val: string) => void;
  setError: (val: string | null) => void;
  setCacheNotification: (
    val: {
      message: string;
      item?: PostAnalysisHistoryItemDto;
      isManualMatch?: boolean;
    } | null,
  ) => void;
  handleExtractHtml: (event: React.FormEvent<HTMLFormElement>) => void;
  handleAnalyzeHtml: (event: React.FormEvent<HTMLFormElement> | null, force?: boolean) => void;
  toggleImageSelection: (url: string) => void;
}

export function FacebookTab({
  htmlSource,
  setHtmlSource,
  extractedData,
  setExtractedData,
  selectedImages,
  setSelectedImages,
  isExtracting,
  isAnalyzingHtml,
  editableText,
  setEditableText,
  setError,
  setCacheNotification,
  handleExtractHtml,
  handleAnalyzeHtml,
  toggleImageSelection,
}: FacebookTabProps) {
  if (!extractedData) {
    return (
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
    );
  }

  return (
    <form onSubmit={(e) => handleAnalyzeHtml(e)} className="space-y-5 animate-fade-slide-in">
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
  );
}
