import crypto from 'node:crypto';

import { getDatabase } from '@/infrastructure/db/mongo-client';
import { getInMemoryJob, type ScanJob } from '@/services/scan-job-store';
import { isRecord } from '@/utils/type-guards';

export async function pollJobProgress(
  origin: string,
  jobId: string,
  onProgress: (progress: {
    stage: string;
    message: string;
    percent: number;
    detail?: Record<string, number | string>;
  }) => void
): Promise<Record<string, unknown>> {
  void origin;
  const TIMEOUT_MS = 30 * 60 * 1000;
  const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
  const startedAt = Date.now();
  let lastProgressAt = startedAt;
  let lastProgressSignature = '';

  while (Date.now() - startedAt < TIMEOUT_MS && Date.now() - lastProgressAt < IDLE_TIMEOUT_MS) {
    const progress = await readScanJobProgress(jobId);
    if (!progress) {
      throw new Error('cannotReadScanProgress');
    }

    onProgress({
      stage: progress.stage ?? 'running',
      message: progress.message ?? 'scanning',
      percent: progress.percent ?? 0,
      detail: normalizeJobDetail(progress.detail),
    });

    if (progress.status === 'done') {
      return (progress.result ?? {}) as Record<string, unknown>;
    }

    if (progress.status === 'error') {
      throw new Error(progress.error ?? progress.message ?? 'scanFailed');
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

    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  throw new Error('scanTimeout');
}

async function readScanJobProgress(jobId: string): Promise<ScanJob | null> {
  const memoryJob = getInMemoryJob(jobId);
  if (memoryJob) {
    return memoryJob;
  }

  const db = await getDatabase();
  const doc = await db.collection('scan_jobs').findOne({ id: jobId });
  if (!doc) {
    return null;
  }

  return {
    id: typeof doc.id === 'string' ? doc.id : jobId,
    ownerId: typeof doc.ownerId === 'string' ? doc.ownerId : '',
    status:
      doc.status === 'queued' ||
      doc.status === 'running' ||
      doc.status === 'done' ||
      doc.status === 'error'
        ? doc.status
        : 'running',
    percent: typeof doc.percent === 'number' ? doc.percent : 0,
    message: typeof doc.message === 'string' ? doc.message : 'scanning',
    stage: typeof doc.stage === 'string' ? doc.stage : undefined,
    result: doc.result,
    error: typeof doc.error === 'string' ? doc.error : undefined,
    detail: doc.detail,
    createdAt: normalizeJobDate(doc.createdAt),
    updatedAt: normalizeJobDate(doc.updatedAt),
  };
}

function normalizeJobDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return new Date().toISOString();
}

function normalizeJobDetail(value: unknown): Record<string, number | string> | undefined {
  if (!isRecord(value)) {
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

export async function startInventoryScanJob(input: {
  steamUrl: string;
  steamCookie?: string;
  forceRefresh?: boolean;
  ownerId: string;
}): Promise<string> {
  const [{ createScanJob }, { runScanJob }] = await Promise.all([
    import('@/services/scan-job-store'),
    import('@/services/scan-service'),
  ]);
  const jobId = crypto.randomUUID();
  await createScanJob(jobId, {
    id: jobId,
    ownerId: input.ownerId,
    status: 'queued',
    percent: 0,
    message: 'waitingScan',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  void runScanJob(jobId, input);
  return jobId;
}
