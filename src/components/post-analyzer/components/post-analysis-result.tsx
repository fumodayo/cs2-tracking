import { FileImage } from 'lucide-react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '@/components/currency-provider';
import { CaseThumbnail } from '@/components/portfolio';
import type { PostAnalysisDto } from '@/types/post-analysis';

export function Metric({
  label,
  value,
  subLabel,
  variant = 'default',
  className = '',
}: {
  label: string;
  value: string;
  subLabel?: string;
  variant?: 'default' | 'accent' | 'success' | 'warning';
  className?: string;
}) {
  const borderColors = {
    default: 'border-l-stone-500',
    accent: 'border-l-blue-500',
    success: 'border-l-emerald-500',
    warning: 'border-l-amber-500',
  };

  const textColors = {
    default: 'text-stone-50',
    accent: 'text-blue-400 font-extrabold',
    success: 'text-emerald-400 font-extrabold',
    warning: 'text-amber-400 font-extrabold',
  };

  return (
    <div
      className={`rounded-lg border border-l-2 border-stone-800 bg-stone-900/35 p-2 sm:border-l-4 sm:p-4 ${borderColors[variant]} flex flex-col justify-between shadow-sm ${className}`}
    >
      <div>
        <p className="xs:text-[8px] text-[7.5px] leading-tight font-semibold tracking-wider text-stone-500 uppercase sm:text-[10px]">
          {label}
        </p>
        <p
          className={`xs:text-xs mt-0.5 text-[10px] font-bold tracking-tight sm:mt-2 sm:text-xl md:text-2xl ${textColors[variant]} whitespace-nowrap`}
        >
          {value}
        </p>
      </div>
      {subLabel && (
        <p className="xs:text-[8.5px] mt-1 text-[7.5px] font-semibold whitespace-nowrap text-stone-400 sm:mt-2 sm:text-[10px]">
          {subLabel}
        </p>
      )}
    </div>
  );
}

export function AnalysisResult({ analysis }: { analysis: PostAnalysisDto }) {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  return (
    <div className="mt-5 space-y-5">
      {/* Post Metadata Card */}
      {(analysis.author || analysis.postTime || analysis.steamUrl) && (
        <div className="border-stone-850 space-y-3 rounded-xl border bg-stone-900/10 p-4">
          <div className="border-stone-850/80 flex flex-col justify-between gap-2 border-b pb-2.5 sm:flex-row sm:items-center">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-200">
              <span className="size-2 animate-pulse rounded-full bg-blue-400" />
              {t('postAnalyzer.analysisInfo')}
            </h3>
            {analysis.postUrl && (
              <a
                href={analysis.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-semibold text-blue-400 transition-colors hover:text-blue-300"
              >
                {t('postAnalyzer.viewOriginalOnFacebook')}
              </a>
            )}
          </div>
          <div className="grid gap-4 text-sm sm:grid-cols-2 md:grid-cols-3">
            {analysis.author && (
              <div className="min-w-0">
                <span className="mb-0.5 block text-[10px] font-semibold tracking-wider text-stone-500 uppercase">
                  {t('postAnalyzer.author')}
                </span>
                {analysis.authorUrl ? (
                  <a
                    href={analysis.authorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate font-bold text-blue-400 transition-colors hover:text-blue-300"
                  >
                    {analysis.author}
                  </a>
                ) : (
                  <span className="block truncate font-bold text-stone-200">{analysis.author}</span>
                )}
              </div>
            )}
            {analysis.postTime && (
              <div>
                <span className="mb-0.5 block text-[10px] font-semibold tracking-wider text-stone-400 uppercase">
                  {t('postAnalyzer.postTime')}
                </span>
                <span className="block truncate font-medium text-stone-300">
                  {analysis.postTime}
                </span>
              </div>
            )}
            {analysis.steamUrl && (
              <div className="min-w-0 sm:col-span-2 md:col-span-1">
                <span className="text-stone-405 mb-0.5 block text-[10px] font-semibold tracking-wider uppercase">
                  {t('postAnalyzer.steamInventoryLink')}
                </span>
                <a
                  href={analysis.steamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate font-bold text-emerald-400 transition-colors hover:text-emerald-300"
                >
                  {analysis.steamUrl}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Level Summary Cards */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
        <Metric
          label={t('postAnalyzer.totalSteam')}
          value={formatCurrency(analysis.totalSteamValue)}
          subLabel={`${t('postAnalyzer.totalItems')}: ${new Intl.NumberFormat('vi-VN').format(analysis.totalQuantity)}`}
          variant="default"
        />
        <Metric
          label={t('postAnalyzer.totalIfRetail')}
          value={formatCurrency(analysis.totalItemRateValue)}
          subLabel={`${t('postAnalyzer.retailRate')}: ${analysis.itemRate.toFixed(2)}`}
          variant="warning"
        />
        <Metric
          label={t('postAnalyzer.totalIfBulk')}
          value={formatCurrency(analysis.totalAllRateValue)}
          subLabel={`${t('postAnalyzer.bulkRate')}: ${analysis.allRate.toFixed(2)}`}
          variant="success"
        />
      </div>

      <p className="text-stone-555 text-xs leading-relaxed">
        {t('postAnalyzer.quantitySource')}
        <span className="font-semibold text-stone-300">
          {analysis.itemSource === 'image'
            ? t('postAnalyzer.uploadedInventoryImage')
            : t('postAnalyzer.postContent')}
        </span>
        {analysis.cacheStatus === 'hit' ? (
          <span className="ml-1.5 rounded bg-stone-900 px-1.5 py-0.5 font-medium text-stone-400">
            {t('postAnalyzer.usedSavedResults')}
          </span>
        ) : null}
      </p>

      {analysis.imageCloudinaryUrl ? (
        <div className="rounded-xl border border-stone-800 bg-stone-950/20 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-stone-400 uppercase">
            <FileImage className="size-4 text-blue-400" />
            {t('postAnalyzer.scannedInventoryImage')}
          </h3>
          <div className="group border-stone-850 relative aspect-[4/3] w-full max-w-sm overflow-hidden rounded-lg border bg-stone-900 sm:aspect-[16/10]">
            <a
              href={analysis.imageCloudinaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 block cursor-zoom-in"
              title={t('postAnalyzer.clickToViewOriginalImage')}
            >
              <Image
                src={analysis.imageCloudinaryUrl}
                alt={t('postAnalyzer.scannedInventoryAlt', 'Scanned CS2 Inventory')}
                fill
                sizes="(max-w-sm) 100vw, 384px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                unoptimized
              />
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-stone-950/90 via-stone-950/20 to-transparent p-3 opacity-0 transition-opacity duration-205 group-hover:opacity-100">
                <span className="flex items-center gap-1 text-xs font-medium text-blue-300">
                  {t('postAnalyzer.viewFullSizeImage')}
                </span>
              </div>
            </a>
          </div>
        </div>
      ) : null}

      {/* Main Analysis Details Table - Desktop */}
      <div className="hidden overflow-hidden rounded-xl border border-stone-800 bg-stone-950/10 md:block">
        <div className="max-h-[500px] scrollbar-thin overflow-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-stone-900/90 text-xs tracking-wider text-stone-400 uppercase backdrop-blur-sm">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">{t('postAnalyzer.item')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('postAnalyzer.qtyShort')}</th>
                <th className="px-5 py-3 text-right font-semibold">
                  {t('postAnalyzer.steamPrice')}
                </th>
                <th className="px-5 py-3 text-right font-semibold">
                  {t('postAnalyzer.retailPriceTimesRate')}
                </th>
                <th className="px-5 py-3 text-right font-semibold">
                  {t('postAnalyzer.totalBulkRate')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-stone-850 divide-y">
              {analysis.rows.map((row) => (
                <tr
                  key={row.marketHashName}
                  className="text-stone-200 transition-colors hover:bg-stone-900/20"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <CaseThumbnail imageUrl={row.imageUrl} name={row.name} size="sm" />
                      <div className="min-w-0">
                        <div className="text-stone-55 truncate font-semibold">{row.name}</div>
                        <div className="truncate text-xs text-stone-500">
                          {t('postAnalyzer.fromPostPrefix', { name: row.inputName })}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-stone-100">
                    {new Intl.NumberFormat('vi-VN').format(row.quantity)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-stone-300">
                    {formatCurrency(row.steamUnitPrice)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-stone-300">
                    {formatCurrency(row.itemRateUnitPrice)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold text-blue-400">
                    {formatCurrency(row.allRateTotalPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Analysis Details List - Mobile */}
      <div className="space-y-3 md:hidden">
        <div className="pl-1 text-[10px] font-bold tracking-wider text-stone-500 uppercase">
          {t('postAnalyzer.itemDetailsMobile', 'Chi tiết vật phẩm')}
        </div>
        <div className="max-h-[480px] scrollbar-thin space-y-3 overflow-y-auto pr-1.5">
          {analysis.rows.map((row) => (
            <div
              key={row.marketHashName}
              className="border-stone-850 space-y-3.5 rounded-xl border bg-stone-900/10 p-3.5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <CaseThumbnail imageUrl={row.imageUrl} name={row.name} size="sm" />
                  <div className="min-w-0">
                    <div className="text-sm leading-snug font-bold text-stone-100">{row.name}</div>
                    <div className="mt-0.5 truncate text-[10px] text-stone-500">
                      {t('postAnalyzer.fromPostPrefix', { name: row.inputName })}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 rounded border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-300">
                  x{new Intl.NumberFormat('vi-VN').format(row.quantity)}
                </div>
              </div>

              <div className="border-stone-850/80 grid grid-cols-3 gap-2 border-t pt-3 text-[10px]">
                <div>
                  <span className="mb-1 block text-[9px] font-bold tracking-wider text-stone-500 uppercase">
                    Steam
                  </span>
                  <span className="font-mono font-medium text-stone-300">
                    {formatCurrency(row.steamUnitPrice)}
                  </span>
                </div>
                <div>
                  <span className="mb-1 block text-[9px] font-bold tracking-wider text-stone-500 uppercase">
                    Giá lẻ (x Rate)
                  </span>
                  <span className="font-mono font-medium text-stone-300">
                    {formatCurrency(row.itemRateUnitPrice)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="mb-1 block text-[9px] font-bold tracking-wider text-stone-500 uppercase">
                    Tổng sỉ
                  </span>
                  <span className="font-mono font-bold text-blue-400">
                    {formatCurrency(row.allRateTotalPrice)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {analysis.unknownItems.length > 0 ? (
        <div className="rounded-xl border border-blue-500/10 bg-blue-500/[0.02] px-4 py-3 text-xs leading-relaxed text-blue-300">
          <span className="mb-1 block font-semibold">{t('postAnalyzer.unrecognizedItems')}</span>
          {analysis.unknownItems.map((item) => `${item.quantity}x ${item.inputName}`).join(', ')}
        </div>
      ) : null}
    </div>
  );
}
