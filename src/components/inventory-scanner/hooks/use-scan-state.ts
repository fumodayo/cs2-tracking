'use client';

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/stores';
import { AccountEntry, ScanProgress } from '../types';
import { SCAN_PROGRESS_IDLE_TIMEOUT_MS, SCAN_REQUEST_TIMEOUT_MS, extractSteamKey } from '../utils';
import { ScannerState, ScannerAction } from '../scanner-reducer';

interface UseScanStateProps {
  state: ScannerState;
  dispatch: React.Dispatch<ScannerAction>;
  scanAbortControllerRef: React.MutableRefObject<AbortController | null>;
}

export function useScanState({ state, dispatch, scanAbortControllerRef }: UseScanStateProps) {
  const { t } = useTranslation();
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

  const addAccount = useCallback(() => {
    dispatch({ type: 'ADD_ACCOUNT' });
  }, [dispatch]);

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

  /**
   * Periodically polls progress on the server for a queued background scan job.
   */
  const pollScanProgress = useCallback(
    async (jobId: string, accountId: string, signal?: AbortSignal): Promise<ScanProgress> => {
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
    [dispatch, t]
  );

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
          const errorMsg = data.message
            ? t(`inventoryScanner.apiErrors.${data.message}`) !==
              `inventoryScanner.apiErrors.${data.message}`
              ? t(`inventoryScanner.apiErrors.${data.message}`)
              : data.message
            : null;
          throw new Error(
            errorMsg ||
              t('inventoryScanner.apiErrors.errScanRequestGeneric', 'Scan request failed.')
          );
        }

        const scanProgress = await pollScanProgress(String(data.jobId), accountId, activeSignal);
        if (scanProgress.status === 'error' || !scanProgress.result) {
          const rawErr = scanProgress.error ?? scanProgress.message;
          const translatedErr = rawErr
            ? t(`inventoryScanner.apiErrors.${rawErr}`) !== `inventoryScanner.apiErrors.${rawErr}`
              ? t(`inventoryScanner.apiErrors.${rawErr}`)
              : rawErr
            : null;
          throw new Error(
            translatedErr ??
              t('inventoryScanner.apiErrors.errScanInventory', 'Cannot scan inventory.')
          );
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
                ? err.message
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
            error: err instanceof Error ? err.message : t('common.error', 'Error'),
          });
        }
      }
    },
    [dispatch, findUrlDuplicate, pollScanProgress, scanAbortControllerRef, t]
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
              (err instanceof Error ? err.message : t('common.error', 'Error')),
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
