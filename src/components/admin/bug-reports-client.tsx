'use client';

import * as Ably from 'ably';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Clock, User, Eye, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HeroBackground } from '@/components/ui/hero-background';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from '@/stores';
import { formatDateTimeVi } from '@/utils/date';

interface BugReport {
  id: string;
  description: string;
  imageUrl: string | null;
  imageUrls?: string[];
  user: {
    id: string;
    email: string;
    name: string;
  } | null;
  createdAt: string;
  status?: string;
}

type AdminBugReportsRealtimeTokenResponse = {
  tokenDetails?: Ably.TokenDetails;
  channelName?: string;
};

export function AdminBugReportsClient() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'unresolved' | 'resolved'>('unresolved');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  useEffect(() => {
    let disposed = false;
    let client: Ably.Realtime | null = null;
    let channel: Ably.RealtimeChannel | null = null;

    const startRealtime = async () => {
      try {
        const tokenResponse = await fetch('/api/realtime/ably-token?adminBugReports=1', {
          cache: 'no-store',
        });
        if (!tokenResponse.ok) return;

        const realtimeConfig = (await tokenResponse.json()) as AdminBugReportsRealtimeTokenResponse;
        if (!realtimeConfig.tokenDetails || !realtimeConfig.channelName || disposed) {
          return;
        }

        client = new Ably.Realtime({ tokenDetails: realtimeConfig.tokenDetails });
        channel = client.channels.get(realtimeConfig.channelName);
        await channel.subscribe('bug-report.changed', () => {
          void queryClient.invalidateQueries({ queryKey: ['bug-reports'] });
        });

        if (!disposed) {
          setRealtimeConnected(true);
        }
      } catch {
        if (!disposed) {
          setRealtimeConnected(false);
        }
      }
    };

    void startRealtime();

    return () => {
      disposed = true;
      if (channel) {
        void channel.unsubscribe('bug-report.changed');
      }
      client?.close();
    };
  }, [queryClient]);

  // Polling cập nhật realtime mỗi 5 giây
  const {
    data: reports = [],
    isLoading,
    isFetching,
    error,
  } = useQuery<BugReport[]>({
    queryKey: ['bug-reports', activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/bug-report${activeTab === 'resolved' ? '?all=true' : ''}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorKey = errorData.message
          ? `bugReport.errors.${errorData.message}`
          : 'bugReportsAdmin.failedToLoadList';
        throw new Error(
          t(errorKey, {
            defaultValue: errorData.message || (t('bugReportsAdmin.failedToLoadList') as string),
          }) as string
        );
      }
      const data = await res.json();

      // Nếu activeTab là "resolved" thì hiển thị report đã xử lý, ngược lại hiển thị report chưa xử lý
      if (activeTab === 'resolved') {
        return (data as BugReport[]).filter((r: BugReport) => r.status === 'resolved');
      }
      return data as BugReport[];
    },
    refetchInterval: realtimeConnected ? false : 5000,
  });

  // Mutation để cập nhật trạng thái report (ví dụ đánh dấu đã xử lý)
  const resolveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch('/api/bug-report', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorKey = errorData.message
          ? `bugReport.errors.${errorData.message}`
          : 'bugReportsAdmin.failedToUpdateStatus';
        throw new Error(
          t(errorKey, {
            defaultValue:
              errorData.message || (t('bugReportsAdmin.failedToUpdateStatus') as string),
          }) as string
        );
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(
        activeTab === 'unresolved'
          ? t('bugReportsAdmin.markedResolved')
          : t('bugReportsAdmin.restoredPending')
      );
      queryClient.invalidateQueries({ queryKey: ['bug-reports'] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : t('bugReportsAdmin.occurredError');
      toast.error(message);
    },
  });

  const formatDate = (dateStr: string) => {
    return formatDateTimeVi(dateStr);
  };

  return (
    <main className="min-h-screen pb-16">
      {/* Banner / Header */}
      <section className="relative min-h-[12rem] overflow-hidden border-b border-stone-800">
        <HeroBackground opacityClassName="opacity-30" />
        <div className="from-hero-scrim via-hero-scrim absolute inset-0 bg-gradient-to-r to-transparent" />
        <div className="relative mx-auto flex max-w-7xl flex-col justify-end px-4 pt-12 pb-6 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-accent flex items-center gap-2 text-sm font-semibold tracking-[0.18em] uppercase">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
              </span>
              {t('bugReportsAdmin.adminPanel')}
            </p>
            <h1 className="text-foreground mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              {t('bugReportsAdmin.title')}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
              {t('bugReportsAdmin.subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div className="flex gap-2 rounded-lg border border-stone-800 bg-stone-900/50 p-1">
            <button
              onClick={() => setActiveTab('unresolved')}
              className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'unresolved'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <AlertCircle className="size-3.5" />
              {t('bugReportsAdmin.unresolvedTab')}
            </button>
            <button
              onClick={() => setActiveTab('resolved')}
              className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'resolved'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <CheckCircle className="size-3.5" />
              {t('bugReportsAdmin.resolvedTab')}
            </button>
          </div>

          {/* Realtime Status Indicator */}
          <div className="flex items-center gap-2 text-xs text-stone-400">
            {isFetching && !isLoading && (
              <RefreshCw className="size-3 animate-spin text-blue-300" />
            )}
            <span>{realtimeConnected ? 'Realtime' : t('bugReportsAdmin.autoUpdateEvery5s')}</span>
          </div>
        </div>

        {/* Loading / Error States */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <RefreshCw className="size-8 animate-spin text-stone-500" />
          </div>
        ) : error ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-950/20 p-6 text-center">
            <AlertCircle className="size-8 text-red-400" />
            <h3 className="font-semibold text-red-200">{t('bugReportsAdmin.dataLoadError')}</h3>
            <p className="text-xs text-red-300">{(error as Error).message}</p>
          </div>
        ) : reports.length === 0 ? (
          /* Trạng thái rỗng */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-stone-850 flex h-80 flex-col items-center justify-center gap-4 rounded-xl border bg-stone-950/20 p-8 text-center"
          >
            <div className="rounded-full bg-emerald-500/10 p-4">
              <Check className="size-8 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-stone-200">
                {activeTab === 'unresolved'
                  ? t('bugReportsAdmin.noUnresolved')
                  : t('bugReportsAdmin.noResolved')}
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-xs text-stone-400">
                {activeTab === 'unresolved'
                  ? t('bugReportsAdmin.allResolved')
                  : t('bugReportsAdmin.resolvedWillShowHere')}
              </p>
            </div>
          </motion.div>
        ) : (
          /* Lưới report */
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {reports.map((report) => (
                <motion.div
                  key={report.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="flex h-full flex-col overflow-hidden border border-stone-800 bg-stone-900/40 transition-all duration-300 hover:border-stone-700/60">
                    {/* Header */}
                    <div className="border-b border-stone-800 bg-stone-950/20 px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="bg-stone-850 rounded-full p-2 text-stone-400">
                            <User className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="truncate text-xs font-bold text-stone-200">
                              {report.user ? report.user.name : t('bugReportsAdmin.anonymousGuest')}
                            </h4>
                            <p className="truncate text-[10px] text-stone-400">
                              {report.user ? report.user.email : t('bugReportsAdmin.noEmail')}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[10px] text-stone-400">
                            <Clock className="size-3" />
                            {formatDate(report.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 space-y-4 px-5 py-4">
                      <p className="text-xs leading-relaxed whitespace-pre-wrap text-stone-200">
                        {report.description}
                      </p>

                      {/* Image Attachment */}
                      {report.imageUrls && report.imageUrls.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                          {report.imageUrls.map((url, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedImage(url)}
                              className="group border-stone-850 relative flex h-32 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border bg-[#07090d] p-1.5 text-left transition-all hover:border-stone-700 hover:shadow-lg"
                            >
                              <img
                                src={url}
                                alt={t(
                                  'bugReportsAdmin.screenshotAltWithNumber',
                                  'Bug report screenshot {{number}}',
                                  { number: idx + 1 }
                                )}
                                className="h-full w-full rounded-lg object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-stone-950/50 opacity-0 transition-opacity group-hover:opacity-100">
                                <span className="flex items-center gap-1.5 rounded-full bg-stone-900/90 px-3 py-1.5 text-[10px] font-semibold text-stone-200 shadow-md shadow-black/40">
                                  <Eye className="size-3.5" /> {t('bugReportsAdmin.zoomIn')}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        report.imageUrl && (
                          <button
                            type="button"
                            onClick={() => setSelectedImage(report.imageUrl)}
                            className="group border-stone-850 relative flex h-48 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border bg-[#07090d] p-1.5 text-left transition-all hover:border-stone-700 hover:shadow-lg"
                          >
                            <img
                              src={report.imageUrl}
                              alt={t('bugReportsAdmin.screenshotAlt', 'Bug report screenshot')}
                              className="h-full w-full rounded-lg object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-stone-950/50 opacity-0 transition-opacity group-hover:opacity-100">
                              <span className="flex items-center gap-1.5 rounded-full bg-stone-900/90 px-3 py-1.5 text-[10px] font-semibold text-stone-200 shadow-md shadow-black/40">
                                <Eye className="size-3.5" /> {t('bugReportsAdmin.zoomInImage')}
                              </span>
                            </div>
                          </button>
                        )
                      )}
                    </div>

                    {/* Footer / Actions */}
                    <div className="flex items-center justify-between border-t border-stone-800 bg-stone-950/10 px-5 py-3.5">
                      <div className="text-[10px] text-stone-400">
                        ID: <span className="font-mono">{report.id}</span>
                      </div>

                      {activeTab === 'unresolved' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={resolveMutation.isPending}
                          onClick={() =>
                            resolveMutation.mutate({ id: report.id, status: 'resolved' })
                          }
                          className="h-8 border-emerald-500/20 bg-emerald-500/5 px-3.5 text-xs font-semibold text-emerald-400 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10"
                        >
                          {resolveMutation.isPending &&
                          resolveMutation.variables?.id === report.id ? (
                            <RefreshCw className="size-3.5 animate-spin" />
                          ) : (
                            <Check className="size-3.5" />
                          )}
                          {t('bugReportsAdmin.resolvedTab')}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={resolveMutation.isPending}
                          onClick={() =>
                            resolveMutation.mutate({ id: report.id, status: 'pending' })
                          }
                          className="border-stone-750 bg-stone-850 h-8 px-3.5 text-xs font-semibold text-stone-300 transition-all hover:border-stone-700"
                        >
                          {resolveMutation.isPending &&
                          resolveMutation.variables?.id === report.id ? (
                            <RefreshCw className="size-3.5 animate-spin" />
                          ) : (
                            <Clock className="size-3.5" />
                          )}
                          {t('bugReportsAdmin.reopenBug')}
                        </Button>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* Lightbox Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl border-stone-800 bg-stone-950 p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>{t('bugReportsAdmin.screenshot')}</DialogTitle>
            <DialogDescription>{t('bugReportsAdmin.screenshotDetail')}</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[80vh] items-center justify-center overflow-hidden rounded-lg">
            {selectedImage && (
              <img
                src={selectedImage}
                alt={t('bugReportsAdmin.screenshotFullViewAlt', 'Bug report screenshot full view')}
                className="max-h-full max-w-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
