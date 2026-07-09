import { getDatabase } from '@/infrastructure/db/mongo-client';
import { publishScanJobChanged } from '@/services/realtime/scan-events';

export type ScanJob = {
  id: string;
  ownerId: string;
  status: 'queued' | 'running' | 'done' | 'error';
  percent: number;
  message: string;
  stage?: string;
  result?: unknown;
  error?: string;
  detail?: unknown;
  createdAt: string;
  updatedAt: string;
};

const scanJobs = getScanJobs();

function getScanJobs(): Map<string, ScanJob> {
  const globalStore = globalThis as typeof globalThis & {
    __cs2InventoryScanJobs?: Map<string, ScanJob>;
  };
  globalStore.__cs2InventoryScanJobs ??= new Map<string, ScanJob>();
  return globalStore.__cs2InventoryScanJobs;
}

export function getInMemoryJob(jobId: string): ScanJob | undefined {
  return scanJobs.get(jobId);
}

export function setInMemoryJob(jobId: string, job: ScanJob) {
  scanJobs.set(jobId, job);
}

export async function createScanJob(jobId: string, job: ScanJob) {
  scanJobs.set(jobId, job);
  try {
    const db = await getDatabase();
    const doc = {
      ...job,
      createdAt: new Date(job.createdAt),
      updatedAt: new Date(job.updatedAt),
    };
    await db.collection('scan_jobs').updateOne({ id: jobId }, { $set: doc }, { upsert: true });
  } catch (err) {
    console.error(`[MongoDB] Failed to create scan job ${jobId}:`, err);
  }
}

export async function updateScanJob(jobId: string, update: Partial<ScanJob>) {
  const current = scanJobs.get(jobId);
  if (!current) return;
  const updated = {
    ...current,
    ...update,
    updatedAt: new Date().toISOString(),
  };
  scanJobs.set(jobId, updated);

  try {
    const db = await getDatabase();
    const doc = {
      ...updated,
      createdAt: new Date(updated.createdAt),
      updatedAt: new Date(updated.updatedAt),
    };
    await db.collection('scan_jobs').updateOne({ id: jobId }, { $set: doc }, { upsert: true });
  } catch (err) {
    console.error(`[MongoDB] Failed to persist scan job ${jobId}:`, err);
  }

  await publishScanJobChanged(updated);
}
