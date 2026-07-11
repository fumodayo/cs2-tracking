'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, Loader2, RotateCcw, Info } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatRelative } from '@/utils/date';
import { PORTFOLIO_QUERY_KEY } from '@/lib/api-client/portfolio-api';
import type { ClientSessionUser } from '@/components/auth/use-session';
import {
  clearUserRecentImports,
  deleteUserRecentImport,
  fetchUserRecentImports,
  mergeUserRecentImports,
  saveUserRecentImport,
  USER_RECENT_IMPORTS_QUERY_KEY,
} from '@/lib/api-client/user-recent-imports-api';
import { subscribeUserRecentImportsChanges } from '@/lib/api-client/user-recent-imports-realtime';
import {
  normalizeRecentImports,
  type RecentImport,
  type RecentImportItemDetail,
} from '@/types/recent-import';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export type { RecentImport, RecentImportItemDetail };

const LOCAL_RECENT_IMPORTS_KEY = 'cs2t_recentImports';

type UseRecentImportsOptions = {
  user: ClientSessionUser | null;
  sessionLoading: boolean;
};

type RemoveRecentImportOptions = {
  syncToServer?: boolean;
};

// eslint-disable-next-line react-refresh/only-export-components
export function useRecentImports({ user, sessionLoading }: UseRecentImportsOptions) {
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const [localRecentImports, setLocalRecentImports] = useState<RecentImport[]>(() =>
    readLocalRecentImports()
  );
  const migratedForUserRef = useRef<string | null>(null);
  const setRecentImports = setLocalRecentImports;

  useEffect(() => {
    try {
      setRecentImports(readLocalRecentImports());
    } catch {
      // Bỏ qua lỗi đọc lịch sử import đã lưu.
    }
  }, [setRecentImports]);

  const recentImportsQuery = useQuery({
    queryKey: USER_RECENT_IMPORTS_QUERY_KEY,
    queryFn: fetchUserRecentImports,
    enabled: Boolean(userId) && !sessionLoading,
    staleTime: 60 * 1000,
    retry: false,
  });

  const serverRecentImports = useMemo(
    () => recentImportsQuery.data ?? [],
    [recentImportsQuery.data]
  );
  const recentImports = userId ? serverRecentImports : localRecentImports;

  useEffect(() => {
    if (!userId || sessionLoading) return;

    return subscribeUserRecentImportsChanges(() => {
      void fetchUserRecentImports()
        .then((items) => {
          queryClient.setQueryData(USER_RECENT_IMPORTS_QUERY_KEY, items);
        })
        .catch((error) => {
          console.error('Failed to refresh realtime recent imports:', error);
          void queryClient.invalidateQueries({ queryKey: USER_RECENT_IMPORTS_QUERY_KEY });
        });
    });
  }, [queryClient, sessionLoading, userId]);

  useEffect(() => {
    if (!userId || sessionLoading || recentImportsQuery.data === undefined) return;
    if (migratedForUserRef.current === userId) return;
    migratedForUserRef.current = userId;

    const local = readLocalRecentImports();
    if (local.length === 0) return;

    const merged = mergeRecentImports(serverRecentImports, local);
    window.localStorage.removeItem(LOCAL_RECENT_IMPORTS_KEY);
    setLocalRecentImports([]);
    queryClient.setQueryData(USER_RECENT_IMPORTS_QUERY_KEY, merged);

    void mergeUserRecentImports(local)
      .then((items) => {
        queryClient.setQueryData(USER_RECENT_IMPORTS_QUERY_KEY, items);
      })
      .catch((error) => {
        console.error('Failed to migrate recent imports:', error);
      });
  }, [queryClient, recentImportsQuery.data, serverRecentImports, sessionLoading, userId]);

  const addRecentImport = (newImport: RecentImport) => {
    if (userId) {
      queryClient.setQueryData<RecentImport[]>(USER_RECENT_IMPORTS_QUERY_KEY, (prev = []) =>
        mergeRecentImports([newImport], prev)
      );

      void saveUserRecentImport(newImport)
        .then((items) => {
          queryClient.setQueryData(USER_RECENT_IMPORTS_QUERY_KEY, items);
        })
        .catch((error) => {
          console.error('Failed to persist recent import:', error);
        });
      return;
    }

    setRecentImports((prev) => {
      const next = [newImport, ...prev].slice(0, 10); // Giữ 10 lần gần nhất
      writeLocalRecentImports(next);
      return next;
    });
  };

  const removeRecentImport = (id: string, options: RemoveRecentImportOptions = {}) => {
    const syncToServer = options.syncToServer ?? true;
    if (userId) {
      queryClient.setQueryData<RecentImport[]>(USER_RECENT_IMPORTS_QUERY_KEY, (prev = []) =>
        prev.filter((x) => x.id !== id)
      );

      if (!syncToServer) {
        return;
      }

      void deleteUserRecentImport(id)
        .then((items) => {
          queryClient.setQueryData(USER_RECENT_IMPORTS_QUERY_KEY, items);
        })
        .catch((error) => {
          console.error('Failed to remove recent import:', error);
        });
      return;
    }

    setRecentImports((prev) => {
      const next = prev.filter((x) => x.id !== id);
      writeLocalRecentImports(next);
      return next;
    });
  };

  const clearAll = () => {
    if (userId) {
      queryClient.setQueryData(USER_RECENT_IMPORTS_QUERY_KEY, []);
      void clearUserRecentImports()
        .then((items) => {
          queryClient.setQueryData(USER_RECENT_IMPORTS_QUERY_KEY, items);
        })
        .catch((error) => {
          console.error('Failed to clear recent imports:', error);
        });
      return;
    }

    setRecentImports([]);
    window.localStorage.removeItem(LOCAL_RECENT_IMPORTS_KEY);
  };

  return { recentImports, addRecentImport, removeRecentImport, clearAll };
}

function readLocalRecentImports(): RecentImport[] {
  if (typeof window === 'undefined') return [];

  try {
    const saved = window.localStorage.getItem(LOCAL_RECENT_IMPORTS_KEY);
    return saved ? normalizeRecentImports(JSON.parse(saved)) : [];
  } catch {
    return [];
  }
}

function writeLocalRecentImports(items: RecentImport[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_RECENT_IMPORTS_KEY, JSON.stringify(items));
}

function mergeRecentImports(...groups: RecentImport[][]): RecentImport[] {
  const byId = new Map<string, RecentImport>();

  for (const item of groups.flat()) {
    byId.set(item.id, item);
  }

  return normalizeRecentImports(Array.from(byId.values()));
}

export function RecentImportsPopover({
  recentImports,
  onRemove,
}: {
  recentImports: RecentImport[];
  onRemove: (id: string, options?: RemoveRecentImportOptions) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [confirmUndoItem, setConfirmUndoItem] = useState<RecentImport | null>(null);
  const [selectedImport, setSelectedImport] = useState<RecentImport | null>(null);

  const undoMutation = useMutation({
    mutationFn: async (importItem: RecentImport) => {
      const res = await fetch('/api/portfolio', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: importItem.importedIds,
          recentImportId: importItem.id,
        }),
      });
      if (!res.ok) throw new Error('Undo failed');
      return importItem.id;
    },
    onMutate: (item) => {
      setUndoingId(item.id);
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEY });
      onRemove(id, { syncToServer: false });
    },
    onSettled: () => {
      setUndoingId(null);
    },
  });

  return (
    <>
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button
            variant="outline"
            disabled={recentImports.length === 0}
            className="h-10 w-10 p-0"
            title={t('dashboard.importHistory')}
          >
            <History className="size-4" />
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={8}
            className="border-border bg-card text-foreground z-50 w-[350px] rounded-xl border p-4 shadow-[0_10px_40px_rgba(0,0,0,0.1)] backdrop-blur-md outline-none dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-foreground text-sm font-semibold">
                {t('dashboard.recentImportHistory')}
              </h4>
            </div>
            {recentImports.length === 0 ? (
              <div className="text-muted-foreground py-4 text-center text-xs">
                {t('dashboard.noImportsYet')}
              </div>
            ) : (
              <div className="max-h-[320px] space-y-3 overflow-x-hidden overflow-y-auto pr-1">
                {recentImports.map((item) => (
                  <div
                    key={item.id}
                    className="group border-border/80 bg-surface/40 hover:bg-surface-muted/20 hover:border-border flex flex-col gap-2 rounded-xl border p-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-200 dark:bg-[#141923]/30 dark:hover:bg-[#141923]/60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-foreground truncate text-xs leading-snug font-semibold sm:text-sm"
                          title={item.fileName}
                        >
                          {item.fileName}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-[10px]">
                          {formatRelative(item.date)}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-600/10 select-none ring-inset dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20">
                          +{item.importedCount}
                        </span>
                      </div>
                    </div>

                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      {item.items && item.items.length > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSelectedImport(item)}
                          title={t('dashboard.viewDetails', 'Xem chi tiết')}
                          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/5 p-0 text-blue-600 shadow-sm transition-all duration-200 hover:bg-blue-500/10 hover:text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 dark:hover:text-blue-300"
                        >
                          <Info className="size-3.5 shrink-0" />
                        </Button>
                      ) : (
                        <div />
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setConfirmUndoItem(item)}
                        disabled={undoMutation.isPending || undoingId === item.id}
                        className="flex h-7 cursor-pointer items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 text-[10px] font-semibold text-red-600 shadow-sm transition-all duration-200 hover:bg-red-500/10 hover:text-red-700 disabled:opacity-50 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 dark:hover:text-red-300"
                      >
                        {undoingId === item.id ? (
                          <Loader2 className="mr-1 size-3 shrink-0 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-1 size-3 shrink-0" />
                        )}
                        {undoingId === item.id ? t('dashboard.undoing') : t('dashboard.undo')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Confirmation Dialog for Undo Import */}
      <ConfirmDialog
        open={confirmUndoItem !== null}
        onClose={() => setConfirmUndoItem(null)}
        title={t('dashboard.confirmUndoImportTitle', 'Confirm Undo Import')}
        description={t(
          'dashboard.confirmUndoImportDesc',
          'Are you sure you want to undo this import? All items added from the file "{{fileName}}" will be deleted from the system.',
          { fileName: confirmUndoItem?.fileName }
        )}
        confirmText={t('common.confirm', 'Xác nhận')}
        cancelText={t('common.cancel', 'Hủy')}
        variant="danger"
        onConfirm={async () => {
          if (confirmUndoItem) {
            await undoMutation.mutateAsync(confirmUndoItem);
          }
        }}
      />

      {/* Item Details Dialog */}
      <Dialog
        open={selectedImport !== null}
        onOpenChange={(open) => !open && setSelectedImport(null)}
      >
        <DialogContent className="border-border bg-card text-foreground max-w-4xl border p-6 shadow-[0_30px_90px_rgba(0,0,0,0.25)] backdrop-blur-3xl sm:rounded-xl dark:shadow-[0_30px_90px_rgba(0,0,0,0.95)]">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-foreground text-xl font-bold">
              {t('dashboard.importedItemsDetails', 'Chi tiết vật phẩm đã nhập')}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              {selectedImport?.fileName} ({selectedImport?.importedCount}{' '}
              {t('common.item', 'vật phẩm')})
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable Table Container */}
          <div className="border-border bg-surface-muted/20 relative max-h-[50vh] min-h-[200px] overflow-y-auto rounded-lg border">
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
              <thead className="bg-surface-muted/60 text-muted-foreground border-border sticky top-0 z-10 border-b text-[11px] font-semibold tracking-wider uppercase shadow-sm backdrop-blur-sm dark:bg-[#0e121e]">
                <tr>
                  <th className="min-w-[200px] px-4 py-3">
                    {t('importExcelConfirm.itemName', 'TÊN VẬT PHẨM')}
                  </th>
                  <th className="w-20 px-4 py-3 text-center">
                    {t('importExcelConfirm.quantityShort', 'SL')}
                  </th>
                  <th className="w-32 px-4 py-3 text-right">
                    {t('importExcelConfirm.buyPriceShort', 'GIÁ MUA')}
                  </th>
                  <th className="w-32 px-4 py-3 text-center">
                    {t('importExcelConfirm.buyDate', 'NGÀY MUA')}
                  </th>
                  <th className="w-32 px-4 py-3 text-center">
                    {t('importExcelConfirm.addedDate', 'NGÀY THÊM')}
                  </th>
                  <th className="w-44 px-4 py-3">{t('importExcelConfirm.note', 'GHI CHÚ')}</th>
                </tr>
              </thead>
              <tbody className="divide-border/50 text-foreground divide-y text-xs sm:text-sm">
                {selectedImport?.items?.map((itemDetail, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-surface-muted/20 transition-colors duration-150"
                  >
                    {/* Tên vật phẩm */}
                    <td className="text-foreground px-4 py-3 font-semibold">
                      <div className="line-clamp-2" title={itemDetail.name}>
                        {itemDetail.name}
                      </div>
                    </td>
                    {/* Số lượng */}
                    <td className="px-4 py-3 text-center font-medium">{itemDetail.quantity}</td>
                    {/* Giá mua */}
                    <td className="px-4 py-3 text-right font-semibold text-blue-600 dark:text-blue-400">
                      {itemDetail.buyPrice.toLocaleString('vi-VN')}
                    </td>
                    {/* Ngày mua */}
                    <td className="text-muted-foreground px-4 py-3 text-center whitespace-nowrap">
                      {itemDetail.buyDate ? itemDetail.buyDate.substring(0, 10) : '—'}
                    </td>
                    {/* Ngày thêm */}
                    <td className="text-muted-foreground px-4 py-3 text-center whitespace-nowrap">
                      {itemDetail.createdAt ? itemDetail.createdAt.substring(0, 10) : '—'}
                    </td>
                    {/* Ghi chú */}
                    <td
                      className="text-muted-foreground max-w-[180px] truncate px-4 py-3"
                      title={itemDetail.note}
                    >
                      {itemDetail.note || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedImport(null)}
              className="h-9 px-4 text-xs font-medium"
            >
              {t('common.close', 'Đóng')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
