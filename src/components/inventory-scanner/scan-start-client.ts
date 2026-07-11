import type { TFunction } from 'i18next';
import { translateAccountError } from './utils';

type ScanStartClientOptions = {
  t: TFunction;
  fetchImpl?: typeof fetch;
};

type StartInventoryScanInput = {
  steamUrl: string;
  steamCookie?: string;
  steamSessionId?: string;
  forceRefresh: boolean;
  signal?: AbortSignal;
};

type ScanStartResponse = {
  message?: string;
  jobId?: string | number;
};

export function createScanStartClient({ t, fetchImpl = fetch }: ScanStartClientOptions) {
  const startInventoryScan = async ({
    steamUrl,
    steamCookie,
    steamSessionId,
    forceRefresh,
    signal,
  }: StartInventoryScanInput): Promise<string> => {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const response = await fetchImpl('/api/inventory/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        steamUrl: steamUrl.trim(),
        steamCookie: steamCookie?.trim() || undefined,
        steamSessionId: steamSessionId?.trim() || undefined,
        forceRefresh,
        progress: true,
      }),
      signal,
    });

    const data = await readScanStartResponse(response, t);
    if (!response.ok) {
      throw new Error(getScanStartErrorMessage(response.status, data, t));
    }

    if (!data.jobId) {
      throw new Error(
        t('inventoryScanner.apiErrors.errReadProgress', 'Cannot read scan progress.')
      );
    }

    return String(data.jobId);
  };

  return {
    startInventoryScan,
  };
}

export async function readScanStartResponse(
  response: Response,
  t: TFunction
): Promise<ScanStartResponse> {
  const responseText = await response.text();
  try {
    return JSON.parse(responseText) as ScanStartResponse;
  } catch {
    throw new Error(
      t('inventoryScanner.apiErrors.errScanRequestHttp', {
        status: response.status,
        defaultValue: `Scan request failed (HTTP ${response.status}).`,
      })
    );
  }
}

export function getScanStartErrorMessage(
  status: number,
  data: ScanStartResponse,
  t: TFunction
): string {
  if (status === 401) {
    return t(
      'inventoryScanner.apiErrors.errLoginRequired',
      'Login required. Please log in to scan.'
    );
  }

  if (data.message) {
    return translateAccountError(data.message, t);
  }

  return t('inventoryScanner.apiErrors.errScanRequestGeneric', 'Scan request failed.');
}
