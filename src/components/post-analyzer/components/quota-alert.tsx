"use client";

import type React from "react";
import { Check, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { buildChatGptPrompt } from "@/services/parser/facebook-parser";
import type { UploadedPostImage } from "../use-post-analyzer";

interface QuotaAlertProps {
  activeTab: "manual" | "facebook";
  text: string;
  editableText: string;
  image: UploadedPostImage | null;
  selectedImages: string[];
  chatGptJsonInput: string;
  setChatGptJsonInput: (val: string) => void;
  isImportingChatGpt: boolean;
  handleImportChatGptJson: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function QuotaAlert({
  activeTab,
  text,
  editableText,
  image,
  selectedImages,
  chatGptJsonInput,
  setChatGptJsonInput,
  isImportingChatGpt,
  handleImportChatGptJson,
}: QuotaAlertProps) {
  const { t } = useTranslation();

  const getPromptImages = () => {
    if (activeTab === "facebook") {
      return selectedImages;
    }
    return image ? [image.previewUrl] : [];
  };

  const promptText = buildChatGptPrompt(
    activeTab === "facebook" ? editableText : text,
    getPromptImages()
  );

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(promptText);
    alert(t("postAnalyzer.promptCopiedToast"));
  };

  return (
    <div className="mt-5 space-y-4 rounded-xl border border-amber-500/15 bg-amber-500/[0.02] p-5 animate-fade-slide-in">
      <div className="flex items-start gap-2.5">
        <span className="text-sm font-bold uppercase tracking-wider text-amber-200 flex items-center gap-1.5">
          {t("postAnalyzer.fixGeminiQuotaError")}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-stone-400">
        {t("postAnalyzer.geminiQuotaDesc")}
      </p>

      <div className="group relative rounded-lg border border-stone-850 bg-stone-950/60 p-3">
        <textarea
          readOnly
          value={promptText}
          rows={5}
          className="w-full resize-none bg-transparent font-mono text-[11px] leading-relaxed text-stone-400 focus:outline-none scrollbar-thin"
        />
        <div className="absolute right-3 bottom-3 flex gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-8 px-3 text-[11px] font-bold"
            onClick={handleCopyPrompt}
          >
            {t("postAnalyzer.copyPrompt")}
          </Button>
          <a
            href="https://gemini.google.com/app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center justify-center rounded-md bg-accent hover:bg-accent-hover px-3 text-[11px] font-bold text-slate-950 transition-all cursor-pointer"
          >
            {t("postAnalyzer.openGeminiWeb")}
          </a>
        </div>
      </div>

      <form
        onSubmit={handleImportChatGptJson}
        className="border-stone-800 space-y-2 border-t pt-4"
      >
        <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider">
          {t("postAnalyzer.importGeminiJsonLabel")}
          <textarea
            value={chatGptJsonInput}
            onChange={(e) => setChatGptJsonInput(e.target.value)}
            placeholder={t("postAnalyzer.pasteGeminiJsonPlaceholder")}
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
                {t("postAnalyzer.processing")}
              </>
            ) : (
              <>
                <Check className="size-4 stroke-[3px]" />
                {t("postAnalyzer.importAndPriceNow")}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
