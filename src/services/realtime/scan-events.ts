import * as Ably from 'ably';

type ScanJobProgressSnapshot = {
  id: string;
  ownerId: string;
  status: 'queued' | 'running' | 'done' | 'error';
  percent: number;
  message: string;
  stage?: string;
  error?: string;
  detail?: unknown;
  updatedAt: string;
};

export type ScanJobRealtimePayload = {
  type: 'scan.progress';
  ownerId: string;
  jobId: string;
  status: ScanJobProgressSnapshot['status'];
  percent: number;
  message: string;
  stage?: string;
  error?: string;
  detail?: Record<string, number | string>;
  updatedAt: string;
};

let ablyRestClient: Ably.Rest | null = null;
let warnedAblyPublishUnauthorized = false;

export async function publishScanJobChanged(job: ScanJobProgressSnapshot): Promise<void> {
  const client = getAblyRestClient();
  if (!client || !job.ownerId || !job.id) return;

  try {
    await client.channels
      .get(getScanRealtimeChannelName(job.ownerId, job.id))
      .publish('scan.progress', toRealtimePayload(job));
  } catch (error) {
    if (isAblyPublishUnauthorized(error)) {
      if (!warnedAblyPublishUnauthorized) {
        warnedAblyPublishUnauthorized = true;
        console.warn(
          'ABLY_API_KEY is not allowed to publish scan progress events. Scanner clients will continue through HTTP polling fallback.'
        );
      }
      return;
    }
    console.error('Failed to publish scan progress event to Ably:', error);
  }
}

export function getScanRealtimeChannelName(ownerId: string, jobId: string): string {
  return `scan:${ownerId}:${jobId}`;
}

function getAblyRestClient(): Ably.Rest | null {
  const apiKey = process.env.ABLY_API_KEY?.trim();
  if (!apiKey) return null;

  ablyRestClient ??= new Ably.Rest({ key: apiKey });
  return ablyRestClient;
}

function isAblyPublishUnauthorized(error: unknown): boolean {
  const maybeAblyError = error as { code?: unknown; statusCode?: unknown };
  return maybeAblyError.code === 40160 || maybeAblyError.statusCode === 401;
}

function toRealtimePayload(job: ScanJobProgressSnapshot): ScanJobRealtimePayload {
  return {
    type: 'scan.progress',
    ownerId: job.ownerId,
    jobId: job.id,
    status: job.status,
    percent: job.percent,
    message: job.message,
    stage: job.stage,
    error: job.error,
    detail: normalizeDetail(job.detail),
    updatedAt: job.updatedAt,
  };
}

function normalizeDetail(value: unknown): Record<string, number | string> | undefined {
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
