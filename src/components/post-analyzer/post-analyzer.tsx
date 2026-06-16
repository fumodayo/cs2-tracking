"use client";

import { Clock3, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { usePostAnalyzer } from "./use-post-analyzer";
import { ManualTab } from "./components/manual-tab";
import { FacebookTab } from "./components/facebook-tab";
import { QuotaAlert } from "./components/quota-alert";
import { CacheMatchAlert } from "./components/cache-match-alert";
import { AnalysisResult } from "./components/post-analysis-result";
import { HistoryRow } from "./components/post-analysis-history";
import { Button } from "@/components/ui/button";
import { SlidePanel, SlidePanelContent, SlidePanelTrigger } from "@/components/ui/slide-panel";

export function PostAnalyzer() {
  const {
    // States
    text,
    setText,
    analysis,
    selectedHistoryId,
    image,
    isDraggingImage,
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

    // Computed
    history,
    historyErrorMessage,
    selectedHistory,
    historyQuery,
    analyzeMutation,

    // Handlers
    handleSubmit,
    handleImageChange,
    handleImageDragOver,
    handleImageDragLeave,
    handleImageDrop,
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
                  className="absolute inset-0 rounded bg-accent shadow-md shadow-accent/25"
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
                  className="absolute inset-0 rounded bg-accent shadow-md shadow-accent/25"
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
          <ManualTab
            text={text}
            setText={setText}
            image={image}
            isDraggingImage={isDraggingImage}
            selectedHistory={selectedHistory}
            isPending={analyzeMutation.isPending}
            handleSubmit={handleSubmit}
            handlePaste={handlePaste}
            handleImageDragOver={handleImageDragOver}
            handleImageDragLeave={handleImageDragLeave}
            handleImageDrop={handleImageDrop}
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
        (error.toLowerCase().includes("quota") ||
          error.toLowerCase().includes("gemini") ||
          error.toLowerCase().includes("billing")) ? (
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
              if (activeTab === "facebook") {
                void handleAnalyzeHtml(null, true);
              } else {
                analyzeMutation.mutate({ text, image, force: true });
              }
            }}
          />
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
