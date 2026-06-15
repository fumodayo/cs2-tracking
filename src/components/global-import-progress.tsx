"use client";

import { useImportStore, importStore } from "@/stores";
import { CheckCircle2, Loader2, XCircle, X, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function GlobalImportProgress() {
  const status = useImportStore();
  const queryClient = useQueryClient();
  const [isUndoing, setIsUndoing] = useState(false);
  const { t } = useTranslation();

  if (status.phase === "idle") return null;

  const handleUndo = async () => {
    if (!status.importedIds || status.importedIds.length === 0) return;
    setIsUndoing(true);
    try {
      await fetch("/api/portfolio", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: status.importedIds }),
      });
      await queryClient.invalidateQueries({ queryKey: ["portfolio-report"] });
      importStore.setState({ phase: "idle" });
    } catch (err) {
      console.error(err);
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div className="fixed left-4 bottom-4 z-50 w-80 rounded-xl border border-border bg-card/90 p-4 shadow-soft backdrop-blur-md animate-fade-slide-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {status.phase === "done" ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
          ) : status.phase === "error" ? (
            <XCircle className="mt-0.5 size-5 shrink-0 text-red-400" />
          ) : (
            <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-blue-400" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-stone-200">
              {status.phase === "reading"
                ? t("importProgress.readingExcel")
                : status.phase === "uploading"
                  ? t("importProgress.uploading")
                  : status.phase === "done"
                    ? t("importProgress.importComplete")
                    : t("importProgress.importError")}
            </p>
            {status.fileName && (
              <p className="mt-0.5 truncate text-xs text-stone-400">
                {status.fileName}
                {status.phase === "uploading" && status.rowsCount
                  ? ` · ${status.rowsCount} ${t("common.rows")}`
                  : ""}
                {status.phase === "done" && status.rowsCount
                  ? ` · ${status.importedCount}/${status.rowsCount} ${t("common.rows")}`
                  : ""}
              </p>
            )}
            {status.message && (
              <p className="mt-1 line-clamp-2 text-xs text-stone-400">
                {status.message}
              </p>
            )}

            {status.phase === "done" &&
              status.importedIds &&
              status.importedIds.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleUndo}
                  disabled={isUndoing}
                  className="mt-2 h-7 gap-1.5 border-stone-700 bg-stone-900 px-2 text-xs font-medium text-stone-300 transition-colors hover:bg-stone-800 hover:text-stone-100 disabled:opacity-50"
                >
                  {isUndoing ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <RotateCcw className="size-3" />
                  )}
                  {isUndoing
                    ? t("importProgress.undoing")
                    : t("importProgress.undoImport")}
                </Button>
              )}
          </div>
        </div>
        <button
          onClick={() => importStore.setState({ phase: "idle" })}
          className="-mt-1 -mr-1 shrink-0 flex items-center justify-center size-6 rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
