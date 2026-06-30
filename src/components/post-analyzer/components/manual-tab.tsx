"use client";

import type React from "react";
import { Calculator, FileImage, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { formatDateTimeVi as formatHistoryDate } from "@/utils/date";
import type { UploadedPostImage } from "../use-post-analyzer";
import type { PostAnalysisHistoryItemDto } from "@/types/post-analysis";

interface ManualTabProps {
  text: string;
  setText: (val: string) => void;
  image: UploadedPostImage | null;
  isDraggingImage: boolean;
  selectedHistory: PostAnalysisHistoryItemDto | null;
  isPending: boolean;
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  handlePaste: (event: React.ClipboardEvent<HTMLFormElement>) => void;
  handleImageDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  handleImageDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  handleImageDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  handleImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  clearImage: () => void;
  isAdmin?: boolean;
}

export function ManualTab({
  text,
  setText,
  image,
  isDraggingImage,
  selectedHistory,
  isPending,
  handleSubmit,
  handlePaste,
  handleImageDragOver,
  handleImageDragLeave,
  handleImageDrop,
  handleImageChange,
  clearImage,
  isAdmin = false,
}: ManualTabProps) {
  const { t } = useTranslation();
  return (
    <form
      onSubmit={handleSubmit}
      onPaste={handlePaste}
      className="space-y-4 animate-fade-slide-in"
    >
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider block">
          {t("postAnalyzer.postToAnalyze")}
        </label>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={7}
          disabled={!isAdmin}
          placeholder={isAdmin ? t("postAnalyzer.placeholderTextareaAdmin") : t("postAnalyzer.placeholderTextareaUser")}
          className="w-full resize-y rounded-lg border border-stone-800 bg-stone-950/40 p-4 text-sm leading-relaxed text-stone-100 outline-none transition-all focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 placeholder:text-stone-700 disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>
      <div
        onDragOver={isAdmin ? handleImageDragOver : undefined}
        onDragLeave={isAdmin ? handleImageDragLeave : undefined}
        onDrop={isAdmin ? handleImageDrop : undefined}
        className={`rounded-xl border border-dashed p-4 transition-all duration-200 ${
          isDraggingImage && isAdmin
            ? "border-blue-500 bg-blue-500/[0.02] scale-[1.01]"
            : "border-stone-800 bg-stone-950/20 hover:border-stone-700 hover:bg-stone-950/30"
        } ${!isAdmin ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-300 uppercase tracking-wider">
              <FileImage className="size-4 text-blue-400" />
              {t("postAnalyzer.inventoryImage")}
            </div>
            <p className="mt-1.5 text-xs text-stone-500 leading-relaxed max-w-xl">
              {t("postAnalyzer.dragDropImageDesc")}
            </p>
          </div>
          <label className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-stone-800 bg-stone-900/60 px-3.5 text-xs font-semibold text-stone-300 hover:bg-stone-800 hover:text-stone-200 hover:border-stone-700 transition-all ${
            isAdmin ? "cursor-pointer" : "cursor-not-allowed opacity-50"
          }`}>
            <FileImage className="size-3.5 text-blue-400" />
            {t("postAnalyzer.uploadImage")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={!isAdmin}
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
                {t("postAnalyzer.imageReadyDesc")}
              </p>
            </div>
            <Tooltip content={t("postAnalyzer.removeImage")}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!isAdmin}
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
        <p className="text-xs text-stone-500">
          {selectedHistory
            ? t("postAnalyzer.reviewingSavedPost", { date: formatHistoryDate(selectedHistory.createdAt) })
            : t("postAnalyzer.newResultsAutoSaved")}
        </p>
        <Button
          type="submit"
          disabled={isPending || (!text.trim() && !image) || !isAdmin}
          variant="primary"
          className="inline-flex h-10 items-center justify-center gap-1.5 px-5 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Calculator className="size-3.5" />
          )}
          <span>{isAdmin ? t("postAnalyzer.analyzePrice") : t("postAnalyzer.analyzePriceComingSoon")}</span>
        </Button>
      </div>
    </form>
  );
}
