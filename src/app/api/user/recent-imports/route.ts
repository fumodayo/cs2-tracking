import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/infrastructure/db/mongo-client';
import { getCurrentUser } from '@/services/auth-service';
import { publishUserRecentImportsChanged } from '@/services/realtime/user-recent-import-events';
import {
  normalizeRecentImport,
  normalizeRecentImports,
  type RecentImport,
} from '@/types/recent-import';
import { getErrorMessage } from '@/utils/error';

const COLLECTION = 'user_recent_imports';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ownerId = await requireOwnerId();
    return NextResponse.json({ recentImports: await readRecentImports(ownerId) });
  } catch (error) {
    return handleRecentImportsError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ownerId = await requireOwnerId();
    const body = (await request.json()) as unknown;
    const source = isRecord(body) ? body : {};
    const rawImports: unknown[] = Array.isArray(source.imports)
      ? source.imports
      : [source.import ?? body];
    const imports = rawImports
      .map((item) => normalizeRecentImport(withImportId(item)))
      .filter((item): item is RecentImport => Boolean(item));

    if (imports.length === 0) {
      throw new RecentImportsApiError('invalidRecentImport', 400);
    }

    await upsertRecentImports(ownerId, imports);
    await publishUserRecentImportsChanged(ownerId, imports.length > 1 ? 'merged' : 'created', {
      count: imports.length,
    });
    return NextResponse.json({ recentImports: await readRecentImports(ownerId) });
  } catch (error) {
    return handleRecentImportsError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ownerId = await requireOwnerId();
    const id = request.nextUrl.searchParams.get('id')?.trim();
    const db = await getDatabase();
    const collection = db.collection(COLLECTION);

    if (id) {
      await collection.deleteOne({ ownerId, id });
      await publishUserRecentImportsChanged(ownerId, 'deleted', { id });
    } else {
      await collection.deleteMany({ ownerId });
      await publishUserRecentImportsChanged(ownerId, 'cleared');
    }

    return NextResponse.json({ recentImports: await readRecentImports(ownerId) });
  } catch (error) {
    return handleRecentImportsError(error);
  }
}

async function requireOwnerId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) {
    throw new RecentImportsApiError('unauthorized', 401);
  }
  return `google:${user.id}`;
}

async function readRecentImports(ownerId: string): Promise<RecentImport[]> {
  const db = await getDatabase();
  const docs = await db
    .collection(COLLECTION)
    .find({ ownerId })
    .project({ _id: 0, ownerId: 0 })
    .sort({ date: -1, updatedAt: -1 })
    .limit(10)
    .toArray();

  return normalizeRecentImports(docs);
}

async function upsertRecentImports(ownerId: string, imports: RecentImport[]): Promise<void> {
  const now = new Date();
  const db = await getDatabase();
  await db.collection(COLLECTION).bulkWrite(
    imports.map((item) => ({
      updateOne: {
        filter: { ownerId, id: item.id },
        update: {
          $set: { ...item, ownerId, updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  );
}

function withImportId(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  return {
    ...value,
    id: typeof value.id === 'string' && value.id.trim() ? value.id : crypto.randomUUID(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function handleRecentImportsError(error: unknown) {
  if (error instanceof RecentImportsApiError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { message: getErrorMessage(error, 'cannotSyncRecentImports') },
    { status: 500 }
  );
}

class RecentImportsApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}
