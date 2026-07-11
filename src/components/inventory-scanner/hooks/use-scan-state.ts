'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/stores';
import { AccountEntry, ScanProgress } from '../types';
import { extractSteamKey, translateAccountError } from '../utils';
import { ScannerState, ScannerAction } from '../scanner-reducer';
import { createScanProgressClient } from '../scan-progress-client';
import { createScanStartClient } from '../scan-start-client';
import { waitForAbortableDelay } from '../abortable-delay';

interface UseScanStateProps {
  state: ScannerState;
  dispatch: React.Dispatch<ScannerAction>;
  scanAbortControllerRef: React.MutableRefObject<AbortController | null>;
}

export function useScanState({ state, dispatch, scanAbortControllerRef }: UseScanStateProps) {
  const { t } = useTranslation();
  const activePollKeysRef = useRef<Set<string>>(new Set());
  const scanProgressClient = useMemo(
    () =>
      createScanProgressClient({
        t,
        onProgress: (accountId, progress) => {
          dispatch({ type: 'UPDATE_SCAN_PROGRESS', accountId, progress });
        },
      }),
    [dispatch, t]
  );
  const scanStartClient = useMemo(() => createScanStartClient({ t }), [t]);
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
          const scanProgress = await scanProgressClient.pollScanProgress(
            jobId,
            account.id,
            controller.signal
          );
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
  }, [
    dispatch,
    getScanProgressError,
    scanProgressClient,
    scanAbortControllerRef,
    state.accounts,
    t,
  ]);

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

        const jobId = await scanStartClient.startInventoryScan({
          steamUrl: account.url,
          steamCookie: account.steamCookie,
          steamSessionId: account.steamSessionId,
          forceRefresh,
          signal: activeSignal,
        });
        const pollKey = `${accountId}:${jobId}`;
        activePollKeysRef.current.add(pollKey);
        dispatch({ type: 'REGISTER_SCAN_JOB', accountId, jobId });

        let scanProgress: ScanProgress;
        try {
          scanProgress = await scanProgressClient.pollScanProgress(jobId, accountId, activeSignal);
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
    [
      dispatch,
      findUrlDuplicate,
      getScanProgressError,
      scanProgressClient,
      scanStartClient,
      scanAbortControllerRef,
      t,
    ]
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
            await waitForAbortableDelay(500, signal);
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
