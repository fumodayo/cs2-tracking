"use client";

import { useState, useEffect } from "react";
import { History, Loader2, RotateCcw, Trash2, X } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatRelative } from "@/utils/date";

import { Button } from "@/components/ui/button";
export type RecentImport = {
  id: string;
  fileName: string;
  date: string;
  importedCount: number;
  importedIds: string[];
};

export function useRecentImports() {
  const [recentImports, setRecentImports] = useState<RecentImport[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cs2t_recentImports");
      if (saved) {
        setRecentImports(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  const addRecentImport = (newImport: RecentImport) => {
    setRecentImports((prev) => {
      const next = [newImport, ...prev].slice(0, 10); // Keep last 10
      localStorage.setItem("cs2t_recentImports", JSON.stringify(next));
      return next;
    });
  };

  const removeRecentImport = (id: string) => {
    setRecentImports((prev) => {
      const next = prev.filter((x) => x.id !== id);
      localStorage.setItem("cs2t_recentImports", JSON.stringify(next));
      return next;
    });
  };

  const clearAll = () => {
    setRecentImports([]);
    localStorage.removeItem("cs2t_recentImports");
  };

  return { recentImports, addRecentImport, removeRecentImport, clearAll };
}

export function RecentImportsPopover({
  recentImports,
  onRemove,
}: {
  recentImports: RecentImport[];
  onRemove: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const undoMutation = useMutation({
    mutationFn: async (importItem: RecentImport) => {
      const res = await fetch("/api/portfolio", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: importItem.importedIds }),
      });
      if (!res.ok) throw new Error("Undo failed");
      return importItem.id;
    },
    onMutate: (item) => {
      setUndoingId(item.id);
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["portfolio-report"] });
      onRemove(id);
    },
    onSettled: () => {
      setUndoingId(null);
    },
  });

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button
          variant="outline"
          disabled={recentImports.length === 0}
          className="h-10 w-10 p-0"
          title="Lịch sử Import"
        >
          <History className="size-4" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 rounded-lg border border-border bg-surface p-3 shadow-xl outline-none"
        >
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">
              Lịch sử Import gần đây
            </h4>
          </div>
          {recentImports.length === 0 ? (
            <div className="py-4 text-center text-sm text-stone-500">
              Chưa có file nào được import.
            </div>
          ) : (
            <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
              {recentImports.map((item) => (
                <div
                  key={item.id}
                  className="group flex flex-col gap-1.5 rounded-md border border-border bg-surface-muted p-2.5 transition-colors hover:border-stone-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-medium text-stone-200"
                        title={item.fileName}
                      >
                        {item.fileName}
                      </p>
                      <p className="text-[11px] text-stone-400">
                        {formatRelative(item.date)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-xs font-semibold text-emerald-400">
                        +{item.importedCount}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-end">
                    <Button
                      type="button"
                      onClick={() => undoMutation.mutate(item)}
                      disabled={undoMutation.isPending || undoingId === item.id}
                      className="inline-flex items-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {undoingId === item.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3" />
                      )}
                      {undoingId === item.id ? "Đang xóa..." : "Hoàn tác (Xóa)"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
