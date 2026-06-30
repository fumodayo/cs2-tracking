"use client";

import { PostAnalyzer } from "@/components/post-analyzer";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useTranslation } from "react-i18next";

export default function PostAnalysisPage() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5">
        <p className="text-sm font-semibold tracking-[0.18em] text-blue-300 uppercase">
          {t("postAnalyzer.pageTitle")}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-50">
          {t("postAnalyzer.pageTitle")}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-400">
          {t("postAnalyzer.pageDescription")}
        </p>
      </div>

      <ErrorBoundary>
        <PostAnalyzer />
      </ErrorBoundary>
    </main>
  );
}
