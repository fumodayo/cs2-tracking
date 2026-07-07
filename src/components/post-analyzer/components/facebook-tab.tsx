'use client';

import type React from 'react';
import { Calculator, Check, Eye, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { PostAnalysisHistoryItemDto } from '@/types/post-analysis';

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
  setExtractedData: (
    val: {
      text: string;
      author: string;
      imageUrls: string[];
      postTime?: string;
      authorUrl?: string;
      postUrl?: string;
      steamUrl?: string;
    } | null
  ) => void;
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
    } | null
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
  const { t } = useTranslation();

  if (!extractedData) {
    return (
      <form onSubmit={handleExtractHtml} className="animate-fade-slide-in space-y-5">
        <div className="rounded-xl border border-blue-500/10 bg-blue-500/[0.02] p-4 text-xs leading-relaxed text-blue-300">
          <span className="mb-2 block flex items-center gap-1.5 text-xs font-bold tracking-wider text-blue-200 uppercase">
            {t('postAnalyzer.fbGuideTitle')}
          </span>
          <ol className="list-decimal space-y-2 pl-4 text-stone-400">
            <li>
              {t('postAnalyzer.fbGuideStep1Before')}
              <strong>{t('postAnalyzer.fbGuideStep1Bold')}</strong>
              {t('postAnalyzer.fbGuideStep1After')}
            </li>
            <li>
              {t('postAnalyzer.fbGuideStep2Before')}
              <kbd className="rounded border border-stone-800 bg-stone-900 px-1 py-0.5 font-mono text-[10px] text-white">
                Ctrl + U
              </kbd>
              {t('postAnalyzer.fbGuideStep2After')}
              <strong>{t('postAnalyzer.fbGuideStep2Bold')}</strong>).
            </li>
            <li>
              {t('postAnalyzer.fbGuideStep3Before')}
              <kbd className="rounded border border-stone-800 bg-stone-900 px-1 py-0.5 font-mono text-[10px] text-white">
                Ctrl + A
              </kbd>
              {t('postAnalyzer.fbGuideStep3Between')}
              <kbd className="rounded border border-stone-800 bg-stone-900 px-1 py-0.5 font-mono text-[10px] text-white">
                Ctrl + C
              </kbd>
              {t('postAnalyzer.fbGuideStep3After')}
            </li>
            <li>
              {t('postAnalyzer.fbGuideStep4Before')}
              <kbd className="rounded border border-stone-800 bg-stone-900 px-1 py-0.5 font-mono text-[10px] text-white">
                Ctrl + V
              </kbd>
              {t('postAnalyzer.fbGuideStep4After')}
            </li>
          </ol>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold tracking-wider text-stone-400 uppercase">
            {t('postAnalyzer.htmlSourceLabel')}
          </label>
          <textarea
            value={htmlSource}
            onChange={(event) => setHtmlSource(event.target.value)}
            rows={9}
            disabled={true}
            placeholder={t('postAnalyzer.placeholderHtmlTextareaUser')}
            className="w-full resize-y rounded-lg border border-stone-800 bg-stone-950/40 p-4 font-mono text-xs text-stone-100 transition-all outline-none placeholder:text-stone-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        {htmlSource.trim() &&
          (htmlSource.trim().startsWith('http://') ||
            htmlSource.trim().startsWith('https://') ||
            htmlSource.trim().includes('facebook.com')) && (
            <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.02] p-4 text-xs text-amber-300">
              <span className="mb-1.5 block text-xs font-bold tracking-wider text-amber-200 uppercase">
                {t('postAnalyzer.urlDirectLinkWarningTitle')}
              </span>
              {t('postAnalyzer.urlDirectLinkWarningDescBefore')}
              <kbd className="rounded border border-stone-800 bg-stone-900 px-1 py-0.5 font-mono text-[10px] text-white">
                Ctrl + U
              </kbd>
              {t('postAnalyzer.urlDirectLinkWarningDescAfter')}
            </div>
          )}

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={true}
            variant="primary"
            className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 px-5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExtracting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>{t('postAnalyzer.extracting')}</span>
              </>
            ) : (
              <>
                <Eye className="size-4" />
                <span>{t('postAnalyzer.extractInfoComingSoon')}</span>
              </>
            )}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={(e) => handleAnalyzeHtml(e)} className="animate-fade-slide-in space-y-5">
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.02] p-4 text-xs text-emerald-300">
        <Check className="size-4 shrink-0 text-emerald-400" />
        <span>
          <strong>{t('postAnalyzer.extractSuccess')}</strong> {t('postAnalyzer.extractSuccessDesc')}
        </span>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-stone-800 bg-stone-950/20 p-4 text-xs text-stone-400 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col flex-wrap gap-3 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold tracking-wider text-stone-500 uppercase">
              {t('postAnalyzer.author')}
            </span>
            {extractedData.authorUrl ? (
              <a
                href={extractedData.authorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-400 transition-colors hover:text-blue-300"
              >
                {extractedData.author}
              </a>
            ) : (
              <strong className="text-stone-200">{extractedData.author}</strong>
            )}
          </div>
          {extractedData.postTime && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold tracking-wider text-stone-500 uppercase">
                {t('postAnalyzer.postTime')}
              </span>
              {extractedData.postUrl ? (
                <a
                  href={extractedData.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-stone-300 transition-colors hover:text-stone-200"
                >
                  {extractedData.postTime}
                </a>
              ) : (
                <strong className="text-stone-200">{extractedData.postTime}</strong>
              )}
            </div>
          )}
          {extractedData.steamUrl && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold tracking-wider text-stone-500 uppercase">
                {t('postAnalyzer.steamInventoryLink')}
              </span>
              <a
                href={extractedData.steamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
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
            setHtmlSource('');
            setSelectedImages([]);
            setError(null);
            setCacheNotification(null);
          }}
          className="border-stone-850 h-8 text-[11px] font-semibold hover:bg-stone-900"
        >
          {t('postAnalyzer.backPasteAnother')}
        </Button>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold tracking-wider text-stone-400 uppercase">
          {t('postAnalyzer.postContentEditLabel')}
        </label>
        <textarea
          value={editableText}
          onChange={(event) => setEditableText(event.target.value)}
          rows={7}
          disabled={true}
          className="w-full resize-y rounded-lg border border-stone-800 bg-stone-950/40 p-4 text-sm leading-relaxed text-stone-100 transition-all outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="space-y-2">
        <span className="block text-xs font-semibold tracking-wider text-stone-400 uppercase">
          {t('postAnalyzer.selectInventoryImages', {
            selected: selectedImages.length,
            total: extractedData.imageUrls.length,
          })}
        </span>

        {extractedData.imageUrls.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-800 p-8 text-center text-xs text-stone-500">
            {t('postAnalyzer.noImagesFound')}
          </div>
        ) : (
          <div className="border-stone-855 grid max-h-[18rem] scrollbar-thin grid-cols-2 gap-3 overflow-y-auto rounded-xl border bg-stone-950/40 p-3 opacity-60 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {extractedData.imageUrls.map((url, idx) => {
              const isSelected = selectedImages.includes(url);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={true}
                  onClick={() => toggleImageSelection(url)}
                  className="group relative aspect-[4/3] w-full cursor-not-allowed overflow-hidden rounded-lg border border-none border-stone-800 bg-stone-900 p-0 text-left"
                >
                  <img
                    src={url}
                    alt={t('postAnalyzer.facebookImageAlt', 'Facebook post image {{number}}', {
                      number: idx + 1,
                    })}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div
                    className={`absolute top-2 right-2 flex size-5 items-center justify-center rounded-full transition-all duration-150 ${
                      isSelected
                        ? 'scale-100 bg-stone-500 text-slate-950 opacity-100'
                        : 'scale-75 border border-stone-600 bg-black/60 text-transparent opacity-0'
                    }`}
                  >
                    <Check className="size-3 stroke-[3px]" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <p className="text-[10px] leading-relaxed text-stone-500">
          {t('postAnalyzer.imageSelectionNotice')}
        </p>
      </div>

      <div className="flex justify-end gap-3 border-t border-stone-800/65 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setExtractedData(null);
            setSelectedImages([]);
            setError(null);
            setCacheNotification(null);
          }}
          className="border-stone-850 h-10 px-5 text-xs font-semibold hover:bg-stone-900"
        >
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={true}
          variant="primary"
          className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 px-5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAnalyzingHtml ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>{t('postAnalyzer.analyzing')}</span>
            </>
          ) : (
            <>
              <Calculator className="size-3.5" />
              <span>{t('postAnalyzer.analyzePriceComingSoon')}</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
