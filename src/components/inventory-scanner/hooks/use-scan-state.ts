'use client';

import * as Ably from 'ably';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/stores';
import { AccountEntry, ScanProgress } from '../types';
import {
  SCAN_PROGRESS_IDLE_TIMEOUT_MS,
  SCAN_REQUEST_TIMEOUT_MS,
  extractSteamKey,
  translateAccountError,
} from '../utils';
import { ScannerState, ScannerAction } from '../scanner-reducer';

interface UseScanStateProps {
  state: ScannerState;
  dispatch: React.Dispatch<ScannerAction>;
  scanAbortControllerRef: React.MutableRefObject<AbortController | null>;
}

type ScanRealtimeTokenResponse = {
  tokenDetails?: Ably.TokenDetails;
  channelName?: string;
};

type ScanRealtimePayload = {
  type?: 'scan.progress';
  status?: ScanProgress['status'];
  stage?: string;
  message?: string;
  percent?: number;
  detail?: Record<string, number | string>;
  error?: string;
  updatedAt?: string;
};

const ABLY_PROGRESS_IDLE_FALLBACK_MS = 15_000;

export function useScanState({ state, dispatch, scanAbortControllerRef }: UseScanStateProps) {
  const { t } = useTranslation();
  const activePollKeysRef = useRef<Set<string>>(new Set());
  const updateAccountUrl = useCallback(
    (id: string, url: string) => {
      dispatch({ type: 'UPDATE_ACCOUNT_URL', id, url });
    },
    [dispatch]
  );

  const updateAccountCookie = useCallback(
    (id: string, cookie: string) => {
      dispatch({ type: 'UPDATE_ACCOUNT_COOKIE', id, cookie });
    },
    [dispatch]
  );

  const updateAccountSessionId = useCallback(
    (id: string, sessionId: string) => {
      dispatch({ type: 'UPDATE_ACCOUNT_SESSION_ID', id, sessionId });
    },
    [dispatch]
  );

  const removeAccount = useCallback(
    (id: string) => {
      dispatch({ type: 'REMOVE_ACCOUNT', id });
    },
    [dispatch]
  );

  const addAccount = useCallback(
    (payload?: { url: string; steamCookie: string; steamSessionId: string }) => {
      dispatch({ type: 'ADD_ACCOUNT', payload });
    },
    [dispatch]
  );

  const findUrlDuplicate = useCallback(
    (accountId: string, url: string, currentAccounts: AccountEntry[]): AccountEntry | undefined => {
      const key = extractSteamKey(url);
      if (!key) return undefined;
      return currentAccounts.find((a) => a.id !== accountId && extractSteamKey(a.url) === key);
    },
    []
  );

  const setExpandedAccId = useCallback(
    (id: string | null) => {
      dispatch({ type: 'SET_EXPANDED_ACCOUNT', id });
    },
    [dispatch]
  );

  const fetchScanProgress = useCallback(
    async (jobId: string, signal?: AbortSignal): Promise<ScanProgress> => {
      const response = await fetch(`/api/inventory/scan?jobId=${encodeURIComponent(jobId)}`, {
        cache: 'no-store',
        signal,
      });

      const responseText = await response.text();
      let progress: ScanProgress;
      try {
        progress = JSON.parse(responseText) as ScanProgress;
      } catch {
        throw new Error(
          t('inventoryScanner.apiErrors.pricingServerConnection', {
            status: response.status,
            defaultValue: `Cannot connect to pricing server (HTTP ${response.status}).`,
          })
        );
      }

      if (!response.ok) {
        throw new Error(
          progress.message ??
            t('inventoryScanner.apiErrors.errReadProgress', 'Cannot read scan progress.')
        );
      }

      return progress;
    },
    [t]
  );

  const waitForAblyScanProgress = useCallback(
    async (jobId: string, accountId: string, signal?: AbortSignal): Promise<ScanProgress> => {
      const tokenResponse = await fetch(
        `/api/realtime/ably-token?scanJobId=${encodeURIComponent(jobId)}`,
        { cache: 'no-store', signal }
      );
      if (!tokenResponse.ok) {
        throw new Error('ablyUnavailable');
      }

      const realtimeConfig = (await tokenResponse.json()) as ScanRealtimeTokenResponse;
      if (!realtimeConfig.tokenDetails || !realtimeConfig.channelName) {
        throw new Error('ablyUnavailable');
      }

      return await new Promise<ScanProgress>((resolve, reject) => {
        let settled = false;
        const startedAt = Date.now();
        let lastProgressAt = startedAt;
        let timeoutId: ReturnType<typeof setInterval> | null = null;
        let client: Ably.Realtime | null = null;
        let channel: Ably.RealtimeChannel | null = null;

        const cleanup = () => {
          if (timeoutId) clearInterval(timeoutId);
          signal?.removeEventListener('abort', onAbort);
          if (channel) {
            void channel.unsubscribe('scan.progress', onMessage);
          }
          client?.close();
        };

        const settleResolve = (progress: ScanProgress) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(progress);
        };

        const settleReject = (error: unknown) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        };

        const onAbort = () => {
          settleReject(new DOMException('Aborted', 'AbortError'));
        };

        const handleProgress = async (progress: ScanProgress) => {
          if (settled) return;
          lastProgressAt = Date.now();
          dispatch({ type: 'UPDATE_SCAN_PROGRESS', accountId, progress });

          if (progress.status !== 'done' && progress.status !== 'error') {
            return;
          }

          if (progress.status === 'done' && progress.result) {
            settleResolve(progress);
            return;
          }

          try {
            const latestProgress = await fetchScanProgress(jobId, signal);
            dispatch({ type: 'UPDATE_SCAN_PROGRESS', accountId, progress: latestProgress });
            settleResolve(latestProgress);
          } catch (error) {
            if (progress.status === 'error') {
              settleResolve(progress);
              return;
            }
            settleReject(error);
          }
        };

        const onMessage = (message: Ably.Message) => {
          const progress = parseScanRealtimeProgress(message.data);
          if (!progress) return;
          void handleProgress(progress);
        };

        const start = async () => {
          if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }

          signal?.addEventListener('abort', onAbort, { once: true });
          client = new Ably.Realtime({ tokenDetails: realtimeConfig.tokenDetails });
          channel = client.channels.get(realtimeConfig.channelName!);

          timeoutId = setInterval(() => {
            const elapsed = Date.now() - startedAt;
            const idle = Date.now() - lastProgressAt;
            if (idle >= ABLY_PROGRESS_IDLE_FALLBACK_MS) {
              settleReject(new Error('ablyIdleFallback'));
              return;
            }
            if (elapsed >= SCAN_REQUEST_TIMEOUT_MS || idle >= SCAN_PROGRESS_IDLE_TIMEOUT_MS) {
              settleReject(
                new Error(
                  t(
                    'inventoryScanner.apiErrors.errScanTimeout',
                    'Inventory scan took too long. Please try again.'
                  )
                )
              );
            }
          }, 1000);

          await channel.subscribe('scan.progress', onMessage);
          const currentProgress = await fetchScanProgress(jobId, signal);
          await handleProgress(currentProgress);
        };

        void start().catch(settleReject);
      });
    },
    [dispatch, fetchScanProgress, t]
  );

  /**
   * Định kỳ polling tiến độ trên server cho job quét nền đang xếp hàng.
   */
  const pollScanProgress = useCallback(
    async (jobId: string, accountId: string, signal?: AbortSignal): Promise<ScanProgress> => {
      try {
        return await waitForAblyScanProgress(jobId, accountId, signal);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error;
        }
      }

      const startedAt = Date.now();
      let lastProgressAt = startedAt;
      let lastProgressSignature = '';

      while (
        Date.now() - startedAt < SCAN_REQUEST_TIMEOUT_MS &&
        Date.now() - lastProgressAt < SCAN_PROGRESS_IDLE_TIMEOUT_MS
      ) {
        if (signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        const progress = await fetchScanProgress(jobId, signal);
        dispatch({ type: 'UPDATE_SCAN_PROGRESS', accountId, progress });
        if (progress.status === 'done' || progress.status === 'error') {
          return progress;
        }

        const progressSignature = JSON.stringify({
          percent: progress.percent,
          message: progress.message,
          detail: progress.detail,
          updatedAt: progress.updatedAt,
        });
        if (progressSignature !== lastProgressSignature) {
          lastProgressSignature = progressSignature;
          lastProgressAt = Date.now();
        }

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            if (signal) signal.removeEventListener('abort', onAbort);
            resolve();
          }, 900);

          const onAbort = () => {
            clearTimeout(timeout);
            if (signal) signal.removeEventListener('abort', onAbort);
            reject(new DOMException('Aborted', 'AbortError'));
          };

          if (signal) {
            if (signal.aborted) {
              onAbort();
            } else {
              signal.addEventListener('abort', onAbort);
            }
          }
        });
      }

      throw new Error(
        t(
          'inventoryScanner.apiErrors.errScanTimeout',
          'Inventory scan took too long. Please try again.'
        )
      );
    },
    [dispatch, fetchScanProgress, t, waitForAblyScanProgress]
  );

  const getScanProgressError = useCallback(
    (scanProgress: ScanProgress) => {
      const rawErr = scanProgress.error ?? scanProgress.message;
      if (!rawErr) {
        return t('inventoryScanner.apiErrors.errScanInventory', 'Cannot scan inventory.');
      }

      return translateAccountError(rawErr, t);
    },
    [t]
  );

  useEffect(() => {
    for (const account of state.accounts) {
      if (account.status !== 'scanning' || !account.scanJobId) continue;

      const jobId = account.scanJobId;
      const pollKey = `${account.id}:${jobId}`;
      if (activePollKeysRef.current.has(pollKey)) continue;

      const controller = new AbortController();
      activePollKeysRef.current.add(pollKey);
      scanAbortControllerRef.current = controller;

      void (async () => {
        try {
          const scanProgress = await pollScanProgress(jobId, account.id, controller.signal);
          if (scanProgress.status === 'error' || !scanProgress.result) {
            dispatch({
              type: 'SCAN_FAILURE',
              accountId: account.id,
              error: getScanProgressError(scanProgress),
            });
            return;
          }

          dispatch({
            type: 'SCAN_SUCCESS',
            accountId: account.id,
            result: scanProgress.result,
            progress: scanProgress,
          });
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            dispatch({ type: 'CANCEL_SCAN', accountId: account.id });
          } else {
            dispatch({
              type: 'SCAN_FAILURE',
              accountId: account.id,
              error:
                err instanceof Error
                  ? translateAccountError(err.message, t)
                  : t('common.error', 'Error'),
            });
          }
        } finally {
          activePollKeysRef.current.delete(pollKey);
          if (scanAbortControllerRef.current === controller) {
            scanAbortControllerRef.current = null;
          }
        }
      })();
    }
  }, [dispatch, getScanProgressError, pollScanProgress, scanAbortControllerRef, state.accounts, t]);

  const doScan = useCallback(
    async (
      accountId: string,
      forceRefresh: boolean,
      currentAccounts: AccountEntry[],
      signal?: AbortSignal,
      isPartOfScanAll = false
    ) => {
      const account = currentAccounts.find((a) => a.id === accountId);
      if (!account || !account.url.trim()) return;

      const urlDupe = findUrlDuplicate(accountId, account.url, currentAccounts);
      if (urlDupe) {
        const dupeIdx = currentAccounts.indexOf(urlDupe) + 1;
        const dupeName = urlDupe.result?.profile?.name || `TK ${dupeIdx}`;
        dispatch({
          type: 'SCAN_FAILURE',
          accountId,
          error: `duplicateUrlError:${dupeName}`,
        });
        return;
      }

      let activeSignal = signal;
      if (!activeSignal) {
        scanAbortControllerRef.current = new AbortController();
        activeSignal = scanAbortControllerRef.current.signal;
      }

      let toastId: string | null = null;
      if (!isPartOfScanAll) {
        toastId = toast.loading(
          t('inventoryScanner.apiErrors.scanningInventory', 'Scanning inventory...'),
          {
            path: '/inventory-scanner',
          }
        );
      }

      dispatch({ type: 'START_SCAN', accountId });

      try {
        if (activeSignal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const res = await fetch('/api/inventory/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            steamUrl: account.url.trim(),
            steamCookie: account.steamCookie?.trim() || undefined,
            steamSessionId: account.steamSessionId?.trim() || undefined,
            forceRefresh,
            progress: true,
          }),
          signal: activeSignal,
        });

        const resText = await res.text();
        interface ScanStartResponse {
          message?: string;
          jobId?: string | number;
        }
        let data: ScanStartResponse;
        try {
          data = JSON.parse(resText) as ScanStartResponse;
        } catch {
          throw new Error(
            t('inventoryScanner.apiErrors.errScanRequestHttp', {
              status: res.status,
              defaultValue: `Scan request failed (HTTP ${res.status}).`,
            })
          );
        }
        if (!res.ok) {
          if (res.status === 401) {
            throw new Error(
              t(
                'inventoryScanner.apiErrors.errLoginRequired',
                'Login required. Please log in to scan.'
              )
            );
          }
          const errorMsg = data.message ? translateAccountError(data.message, t) : null;
          throw new Error(
            errorMsg ||
              t('inventoryScanner.apiErrors.errScanRequestGeneric', 'Scan request failed.')
          );
        }

        if (!data.jobId) {
          throw new Error(
            t('inventoryScanner.apiErrors.errReadProgress', 'Cannot read scan progress.')
          );
        }

        const jobId = String(data.jobId);
        const pollKey = `${accountId}:${jobId}`;
        activePollKeysRef.current.add(pollKey);
        dispatch({ type: 'REGISTER_SCAN_JOB', accountId, jobId });

        let scanProgress: ScanProgress;
        try {
          scanProgress = await pollScanProgress(jobId, accountId, activeSignal);
        } finally {
          activePollKeysRef.current.delete(pollKey);
        }

        if (scanProgress.status === 'error' || !scanProgress.result) {
          throw new Error(getScanProgressError(scanProgress));
        }
        const scanResult = scanProgress.result;

        dispatch({
          type: 'SCAN_SUCCESS',
          accountId,
          result: scanResult,
          progress: scanProgress,
        });

        if (toastId) {
          toast.dismiss(toastId);
          toast.success(
            t('inventoryScanner.apiErrors.successScan', 'Inventory scanned successfully!'),
            {
              path: '/inventory-scanner',
            }
          );
        }
      } catch (err) {
        if (toastId) {
          toast.dismiss(toastId);
          if (err instanceof DOMException && err.name === 'AbortError') {
            toast.info(t('inventoryScanner.apiErrors.scanStopped', 'Scan stopped.'), {
              path: '/inventory-scanner',
            });
          } else {
            toast.error(
              err instanceof Error
                ? translateAccountError(err.message, t)
                : t('inventoryScanner.apiErrors.scanFailed', 'Scan failed.'),
              {
                path: '/inventory-scanner',
              }
            );
          }
        }

        if (err instanceof DOMException && err.name === 'AbortError') {
          dispatch({
            type: 'CANCEL_SCAN',
            accountId,
          });
        } else {
          dispatch({
            type: 'SCAN_FAILURE',
            accountId,
            error:
              err instanceof Error
                ? translateAccountError(err.message, t)
                : t('common.error', 'Error'),
          });
        }
      }
    },
    [dispatch, findUrlDuplicate, getScanProgressError, pollScanProgress, scanAbortControllerRef, t]
  );

  const scanAll = useCallback(
    async (forceRefresh = false) => {
      const valid = state.accounts.filter((a) => a.url.trim());
      if (!valid.length) return;

      scanAbortControllerRef.current = new AbortController();
      const signal = scanAbortControllerRef.current.signal;

      const toastId = toast.loading(
        t(
          'inventoryScanner.apiErrors.scanningAllProgress',
          'Scanning all inventories in progress...'
        ),
        {
          path: '/inventory-scanner',
        }
      );

      dispatch({ type: 'SET_SCANNING_ALL', scanning: true });
      try {
        dispatch({ type: 'RESET_REMOVED_KEYS' });
        for (let i = 0; i < valid.length; i++) {
          if (signal.aborted) break;
          await doScan(valid[i].id, forceRefresh, state.accounts, signal, true);
          if (i < valid.length - 1 && !signal.aborted) {
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                signal.removeEventListener('abort', onAbort);
                resolve();
              }, 500);

              const onAbort = () => {
                clearTimeout(timeout);
                signal.removeEventListener('abort', onAbort);
                reject(new DOMException('Aborted', 'AbortError'));
              };

              if (signal.aborted) {
                onAbort();
              } else {
                signal.addEventListener('abort', onAbort);
              }
            });
          }
        }

        if (signal.aborted) {
          toast.dismiss(toastId);
          toast.info(t('inventoryScanner.apiErrors.stoppedScanAll', 'Stopped scan all.'), {
            path: '/inventory-scanner',
          });
        } else {
          toast.dismiss(toastId);
          toast.success(
            t('inventoryScanner.apiErrors.scanAllComplete', 'Scan all inventories completed!'),
            {
              path: '/inventory-scanner',
            }
          );
        }
      } catch (err) {
        toast.dismiss(toastId);
        if (err instanceof DOMException && err.name === 'AbortError') {
          toast.info(t('inventoryScanner.apiErrors.stoppedScanAll', 'Stopped scan all.'), {
            path: '/inventory-scanner',
          });
        } else {
          toast.error(
            t('inventoryScanner.apiErrors.scanFailedPrefix', 'Scan failed: ') +
              (err instanceof Error
                ? translateAccountError(err.message, t)
                : t('common.error', 'Error')),
            {
              path: '/inventory-scanner',
            }
          );
        }
      } finally {
        dispatch({ type: 'SET_SCANNING_ALL', scanning: false });
      }
    },
    [state.accounts, doScan, scanAbortControllerRef, dispatch, t]
  );

  const cancelScanAll = useCallback(() => {
    scanAbortControllerRef.current?.abort();
  }, [scanAbortControllerRef]);

  return {
    updateAccountUrl,
    updateAccountCookie,
    updateAccountSessionId,
    removeAccount,
    addAccount,
    doScan,
    scanAll,
    cancelScanAll,
    setExpandedAccId,
  };
}

function parseScanRealtimeProgress(value: unknown): ScanProgress | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const payload = value as ScanRealtimePayload;
  if (
    payload.type !== 'scan.progress' ||
    !isScanStatus(payload.status) ||
    typeof payload.message !== 'string' ||
    typeof payload.percent !== 'number'
  ) {
    return null;
  }

  return {
    status: payload.status,
    stage: typeof payload.stage === 'string' ? payload.stage : payload.status,
    message: payload.message,
    percent: payload.percent,
    detail: normalizeRealtimeDetail(payload.detail),
    error: typeof payload.error === 'string' ? payload.error : undefined,
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : undefined,
  };
}

function isScanStatus(value: unknown): value is ScanProgress['status'] {
  return value === 'queued' || value === 'running' || value === 'done' || value === 'error';
}

function normalizeRealtimeDetail(value: unknown): Record<string, number | string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const detail: Record<string, number | string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'number' || typeof entry === 'string') {
      detail[key] = entry;
    }
  }

  return Object.keys(detail).length > 0 ? detail : undefined;
}
