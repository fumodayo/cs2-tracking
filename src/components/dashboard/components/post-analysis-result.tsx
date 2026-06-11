import { FileImage } from "lucide-react";
import Image from "next/image";
import { useCurrency } from "@/components/currency-provider";
import { CaseThumbnail } from "../case-thumbnail";
import type { PostAnalysisDto } from "@/types/post-analysis";

export function Metric({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: string;
  variant?: "default" | "accent" | "success" | "warning";
}) {
  const borderColors = {
    default: "border-l-stone-500",
    accent: "border-l-blue-500",
    success: "border-l-emerald-500",
    warning: "border-l-amber-500",
  };

  const textColors = {
    default: "text-stone-50",
    accent: "text-blue-400 font-extrabold",
    success: "text-emerald-400 font-extrabold",
    warning: "text-amber-400 font-extrabold",
  };

  return (
    <div className={`rounded-lg border border-stone-800 bg-stone-900/35 p-4 border-l-4 ${borderColors[variant]} shadow-sm`}>
      <p className="text-[10px] font-semibold tracking-wider text-stone-500 uppercase">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${textColors[variant]}`}>{value}</p>
    </div>
  );
}

export function AnalysisResult({ analysis }: { analysis: PostAnalysisDto }) {
  const { formatCurrency } = useCurrency();
  return (
    <div className="mt-5 space-y-5">
      {/* Post Metadata Card */}
      {(analysis.author || analysis.postTime || analysis.steamUrl) && (
        <div className="border-stone-850 space-y-3 rounded-xl border bg-stone-900/10 p-4">
          <div className="border-stone-850/80 flex flex-col justify-between gap-2 border-b pb-2.5 sm:flex-row sm:items-center">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-200">
              <span className="size-2 animate-pulse rounded-full bg-blue-400" />
              Thông tin bài viết đã phân tích
            </h3>
            {analysis.postUrl && (
              <a
                href={analysis.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
              >
                Xem bài viết gốc trên Facebook ↗
              </a>
            )}
          </div>
          <div className="grid gap-4 text-sm sm:grid-cols-2 md:grid-cols-3">
            {analysis.author && (
              <div className="min-w-0">
                <span className="mb-0.5 block text-[10px] font-semibold tracking-wider text-stone-500 uppercase">
                  Người đăng bài
                </span>
                {analysis.authorUrl ? (
                  <a
                    href={analysis.authorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate font-bold text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {analysis.author}
                  </a>
                ) : (
                  <span className="block truncate font-bold text-stone-200">
                    {analysis.author}
                  </span>
                )}
              </div>
            )}
            {analysis.postTime && (
              <div>
                <span className="mb-0.5 block text-[10px] font-semibold tracking-wider text-stone-400 uppercase">
                  Thời gian đăng
                </span>
                <span className="block truncate font-medium text-stone-300">
                  {analysis.postTime}
                </span>
              </div>
            )}
            {analysis.steamUrl && (
              <div className="min-w-0 sm:col-span-2 md:col-span-1">
                <span className="mb-0.5 block text-[10px] font-semibold tracking-wider text-stone-405 uppercase">
                  Steam Inventory Link
                </span>
                <a
                  href={analysis.steamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {analysis.steamUrl}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Level Rates & bulk Sell Payout */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Metric label="Rate lẻ" value={analysis.itemRate.toFixed(2)} variant="accent" />
        <Metric label="Rate all" value={analysis.allRate.toFixed(2)} variant="accent" />
        <Metric
          label="Tổng vật phẩm"
          value={new Intl.NumberFormat("vi-VN").format(analysis.totalQuantity)}
          variant="default"
        />
        <Metric
          label="Tổng lấy all"
          value={formatCurrency(analysis.totalAllRateValue)}
          variant="success"
        />
      </div>

      <p className="text-xs text-stone-550 leading-relaxed">
        * Nguồn số lượng:{" "}
        <span className="font-semibold text-stone-300">
          {analysis.itemSource === "image" ? "Ảnh inventory upload" : "Nội dung bài viết"}
        </span>
        {analysis.cacheStatus === "hit" ? (
          <span className="ml-1.5 rounded bg-stone-900 px-1.5 py-0.5 font-medium text-stone-400">
            Dùng lại kết quả đã lưu
          </span>
        ) : null}
      </p>

      {analysis.imageCloudinaryUrl ? (
        <div className="rounded-xl border border-stone-800 bg-stone-950/20 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-stone-400 uppercase">
            <FileImage className="size-4 text-blue-400" />
            Ảnh kho đồ đã quét (Scanned Inventory Image)
          </h3>
          <div className="group border-stone-850 relative aspect-[4/3] w-full max-w-sm overflow-hidden rounded-lg border bg-stone-900 sm:aspect-[16/10]">
            <a
              href={analysis.imageCloudinaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 block cursor-zoom-in"
              title="Bấm để xem ảnh gốc kích thước đầy đủ"
            >
              <Image
                src={analysis.imageCloudinaryUrl}
                alt="Scanned CS2 Inventory"
                fill
                sizes="(max-w-sm) 100vw, 384px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                unoptimized
              />
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-stone-950/90 via-stone-950/20 to-transparent p-3 opacity-0 transition-opacity duration-205 group-hover:opacity-100">
                <span className="flex items-center gap-1 text-xs font-medium text-blue-300">
                  Xem ảnh kích thước đầy đủ ↗
                </span>
              </div>
            </a>
          </div>
        </div>
      ) : null}

      {/* Main Analysis Details Table */}
      <div className="overflow-hidden rounded-xl border border-stone-800 bg-stone-950/10">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-stone-900/60 text-xs tracking-wider text-stone-400 uppercase">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Vật phẩm</th>
                <th className="px-5 py-3 text-right font-semibold">SL</th>
                <th className="px-5 py-3 text-right font-semibold">Giá Steam</th>
                <th className="px-5 py-3 text-right font-semibold">Giá lẻ x rate</th>
                <th className="px-5 py-3 text-right font-semibold">Tổng all rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-850">
              {analysis.rows.map((row) => (
                <tr key={row.marketHashName} className="text-stone-200 hover:bg-stone-900/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <CaseThumbnail
                        imageUrl={row.imageUrl}
                        name={row.name}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-stone-50">
                          {row.name}
                        </div>
                        <div className="truncate text-xs text-stone-500">
                          Từ bài: {row.inputName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-stone-100 font-mono">
                    {new Intl.NumberFormat("vi-VN").format(row.quantity)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-stone-300">
                    {formatCurrency(row.steamUnitPrice)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-stone-300">
                    {formatCurrency(row.itemRateUnitPrice)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-blue-400 font-mono">
                    {formatCurrency(row.allRateTotalPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Financial Trade-offs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Tổng Steam"
          value={formatCurrency(analysis.totalSteamValue)}
          variant="default"
        />
        <Metric
          label="Tổng nếu bán lẻ"
          value={formatCurrency(analysis.totalItemRateValue)}
          variant="warning"
        />
        <Metric
          label="Tổng lấy all"
          value={formatCurrency(analysis.totalAllRateValue)}
          variant="success"
        />
      </div>

      {analysis.unknownItems.length > 0 ? (
        <div className="rounded-xl border border-blue-500/10 bg-blue-500/[0.02] px-4 py-3 text-xs leading-relaxed text-blue-300">
          <span className="font-semibold block mb-1">🔍 Vật phẩm không nhận diện được:</span>
          {analysis.unknownItems
            .map((item) => `${item.quantity}x ${item.inputName}`)
            .join(", ")}
        </div>
      ) : null}
    </div>
  );
}
