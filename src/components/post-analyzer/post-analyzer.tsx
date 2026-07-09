'use client';

import { useSession } from '@/components/auth/use-session';
import { useTranslation } from 'react-i18next';
import { Clock3, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePostAnalyzer } from './use-post-analyzer';
import { ManualTab } from './components/manual-tab';
import { FacebookTab } from './components/facebook-tab';
import { QuotaAlert } from './components/quota-alert';
import { CacheMatchAlert } from './components/cache-match-alert';
import { AnalysisResult } from './components/post-analysis-result';
import { HistoryRow } from './components/post-analysis-history';
import { Button } from '@/components/ui/button';
import { SlidePanel, SlidePanelContent, SlidePanelTrigger } from '@/components/ui/slide-panel';

export function PostAnalyzer() {
  const { t } = useTranslation();
  const { isAdmin } = useSession();

  const {
    // Các state
    text,
    setText,
    analysis,
    selectedHistoryId,
    image,
    error,
    setError,
    activeTab,
    setActiveTab,
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
    cacheNotification,
    setCacheNotification,
    chatGptJsonInput,
    setChatGptJsonInput,
    isImportingChatGpt,
    historyOpen,
    setHistoryOpen,

    // Giá trị tính toán
    history,
    historyErrorMessage,
    selectedHistory,
    historyQuery,
    analyzeMutation,

    // Các handler
    handleSubmit,
    handleImageChange,
    handlePaste,
    clearImage,
    loadHistoryItem,
    deleteHistoryItem,
    handleExtractHtml,
    handleAnalyzeHtml,
    handleImportChatGptJson,
    toggleImageSelection,
  } = usePostAnalyzer();

  return (
    <div className="space-y-6">
      {!isAdmin && (
        <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-400 shadow-sm sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
            </span>
            <span className="text-xs font-medium sm:text-sm">{t('postAnalyzer.betaDesc')}</span>
          </div>
          <span className="rounded bg-amber-500/20 px-2.5 py-1 text-[10px] font-black tracking-wider text-amber-300 uppercase select-none">
            {t('postAnalyzer.comingSoon')}
          </span>
        </div>
      )}

      <div className="rounded-xl border border-stone-800 bg-stone-950/25 p-6 shadow-sm">
        {/* Thanh trên với tab và lịch sử */}
        <div className="border-stone-850 mb-6 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
          {/* Bộ chọn tab */}
          <div className="relative flex h-10 w-full shrink-0 items-center rounded-lg border border-stone-800 bg-stone-950 p-1 shadow-inner select-none sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setActiveTab('manual');
                setError(null);
                setCacheNotification(null);
              }}
              className={`relative inline-flex h-8 flex-1 cursor-pointer items-center justify-center rounded px-2 py-1.5 text-[11px] font-bold whitespace-nowrap transition-all duration-200 sm:flex-none sm:px-4 sm:text-xs ${
                activeTab === 'manual'
                  ? 'font-extrabold text-white'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {activeTab === 'manual' && (
                <motion.div
                  layoutId="postAnalyzerActiveTab"
                  className="bg-accent shadow-accent/25 absolute inset-0 rounded shadow-md"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">{t('postAnalyzer.manualTab')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('facebook');
                setError(null);
                setCacheNotification(null);
              }}
              className={`relative inline-flex h-8 flex-1 cursor-pointer items-center justify-center rounded px-2 py-1.5 text-[11px] font-bold whitespace-nowrap transition-all duration-200 sm:flex-none sm:px-4 sm:text-xs ${
                activeTab === 'facebook'
                  ? 'font-extrabold text-white'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {activeTab === 'facebook' && (
                <motion.div
                  layoutId="postAnalyzerActiveTab"
                  className="bg-accent shadow-accent/25 absolute inset-0 rounded shadow-md"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">
                <span className="sm:hidden">
                  {t('postAnalyzer.facebookTabMobile', 'Trích xuất Facebook')}
                </span>
                <span className="hidden sm:inline">{t('postAnalyzer.facebookTab')}</span>
              </span>
            </button>
          </div>

          {/* History Slide Panel */}
          <SlidePanel open={historyOpen} onOpenChange={setHistoryOpen}>
            <SlidePanelTrigger asChild>
              <Button
                variant="outline"
                className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 px-4 text-xs font-semibold shadow-sm hover:border-stone-700"
              >
                <Clock3 className="size-4 text-blue-400" />
                <span>{t('postAnalyzer.analysisHistory', { count: history.length })}</span>
              </Button>
            </SlidePanelTrigger>
            <SlidePanelContent
              title={t('postAnalyzer.analysisHistoryTitle')}
              description={t('postAnalyzer.historySavedDesc', { count: history.length })}
            >
              {historyQuery.isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-stone-500">
                  <Loader2 className="mb-2 size-6 animate-spin text-blue-400" />
                  <span>{t('postAnalyzer.loadingHistory')}</span>
                </div>
              ) : history.length === 0 ? (
                <div className="rounded-md border border-dashed border-stone-800 px-4 py-8 text-center text-sm text-stone-500">
                  {t('postAnalyzer.noHistorySaved')}
                </div>
              ) : (
                <div className="space-y-3 pr-1">
                  {history.map((item) => (
                    <HistoryRow
                      key={item.id}
                      item={item}
                      selected={item.id === selectedHistoryId}
                      onLoad={() => loadHistoryItem(item)}
                      onDelete={isAdmin ? () => deleteHistoryItem(item.id) : undefined}
                    />
                  ))}
                </div>
              )}
            </SlidePanelContent>
          </SlidePanel>
        </div>

        {activeTab === 'manual' ? (
          <ManualTab
            text={text}
            setText={setText}
            image={image}
            selectedHistory={selectedHistory}
            isPending={analyzeMutation.isPending}
            handleSubmit={handleSubmit}
            handlePaste={handlePaste}
            handleImageChange={handleImageChange}
            clearImage={clearImage}
          />
        ) : (
          <FacebookTab
            htmlSource={htmlSource}
            setHtmlSource={setHtmlSource}
            extractedData={extractedData}
            setExtractedData={setExtractedData}
            selectedImages={selectedImages}
            setSelectedImages={setSelectedImages}
            isExtracting={isExtracting}
            isAnalyzingHtml={isAnalyzingHtml}
            editableText={editableText}
            setEditableText={setEditableText}
            setError={setError}
            setCacheNotification={setCacheNotification}
            handleExtractHtml={handleExtractHtml}
            handleAnalyzeHtml={handleAnalyzeHtml}
            toggleImageSelection={toggleImageSelection}
          />
        )}

        {error || historyErrorMessage ? (
          <div className="mt-4 rounded-lg border border-red-500/10 bg-red-500/[0.02] px-4 py-3 text-xs text-red-400">
            {error ?? historyErrorMessage}
          </div>
        ) : null}

        {error &&
        (error.toLowerCase().includes('quota') ||
          error.toLowerCase().includes('gemini') ||
          error.toLowerCase().includes('billing')) ? (
          <QuotaAlert
            activeTab={activeTab}
            text={text}
            editableText={editableText}
            image={image}
            selectedImages={selectedImages}
            chatGptJsonInput={chatGptJsonInput}
            setChatGptJsonInput={setChatGptJsonInput}
            isImportingChatGpt={isImportingChatGpt}
            handleImportChatGptJson={handleImportChatGptJson}
          />
        ) : null}

        {cacheNotification ? (
          <CacheMatchAlert
            message={cacheNotification.message}
            isUpdating={isAnalyzingHtml || analyzeMutation.isPending}
            onUpdatePrice={() => {
              if (activeTab === 'facebook') {
                void handleAnalyzeHtml(null, true);
              } else {
                analyzeMutation.mutate({ text, image, force: true });
              }
            }}
          />
        ) : null}
      </div>

      {analysis ? (
        <div className="animate-fade-slide-in rounded-xl border border-stone-800 bg-stone-950/25 p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2.5 text-lg font-bold text-stone-50">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            {t('postAnalyzer.detailAnalysisResult')}
          </h2>
          <AnalysisResult analysis={analysis} />
        </div>
      ) : null}
    </div>
  );
}
