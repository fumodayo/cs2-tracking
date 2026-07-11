import type { ScanProgress } from './types';

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

export function parseScanRealtimeProgress(value: unknown): ScanProgress | null {
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
