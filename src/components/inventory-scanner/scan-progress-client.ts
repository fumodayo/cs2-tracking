import * as Ably from 'ably';
import type { TFunction } from 'i18next';
import type { ScanProgress } from './types';
import { waitForAbortableDelay } from './abortable-delay';
import { parseScanRealtimeProgress } from './scan-progress-payload';
import { SCAN_PROGRESS_IDLE_TIMEOUT_MS, SCAN_REQUEST_TIMEOUT_MS } from './utils';

type ScanRealtimeTokenResponse = {
  tokenDetails?: Ably.TokenDetails;
  channelName?: string;
};

type ScanProgressClientOptions = {
  t: TFunction;
  onProgress: (accountId: string, progress: ScanProgress) => void;
  fetchImpl?: typeof fetch;
};

const ABLY_PROGRESS_IDLE_FALLBACK_MS = 15_000;
const HTTP_POLL_INTERVAL_MS = 900;

export function createScanProgressClient({
  t,
  onProgress,
  fetchImpl = fetch,
}: ScanProgressClientOptions) {
  const fetchScanProgress = async (jobId: string, signal?: AbortSignal): Promise<ScanProgress> => {
    const response = await fetchImpl(`/api/inventory/scan?jobId=${encodeURIComponent(jobId)}`, {
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
  };

  const waitForRealtimeProgress = async (
    jobId: string,
    accountId: string,
    signal?: AbortSignal
  ): Promise<ScanProgress> => {
    const tokenResponse = await fetchImpl(
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
        onProgress(accountId, progress);

        if (progress.status !== 'done' && progress.status !== 'error') {
          return;
        }

        if (progress.status === 'done' && progress.result) {
          settleResolve(progress);
          return;
        }

        try {
          const latestProgress = await fetchScanProgress(jobId, signal);
          onProgress(accountId, latestProgress);
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
        client = new Ably.Realtime({
          tokenDetails: realtimeConfig.tokenDetails,
          transports: ['web_socket'],
        });
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
  };

  const pollScanProgress = async (
    jobId: string,
    accountId: string,
    signal?: AbortSignal
  ): Promise<ScanProgress> => {
    try {
      return await waitForRealtimeProgress(jobId, accountId, signal);
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
      onProgress(accountId, progress);
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

      await waitForAbortableDelay(HTTP_POLL_INTERVAL_MS, signal);
    }

    throw new Error(
      t(
        'inventoryScanner.apiErrors.errScanTimeout',
        'Inventory scan took too long. Please try again.'
      )
    );
  };

  return {
    fetchScanProgress,
    pollScanProgress,
  };
}
