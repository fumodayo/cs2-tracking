import { randomUUID } from 'crypto';
import * as Ably from 'ably';
import { getDatabase } from '@/infrastructure/db/mongo-client';

export type UserRecentImportsRealtimeAction = 'created' | 'merged' | 'deleted' | 'cleared';

export type UserRecentImportsRealtimePayload = {
  id: string;
  type: 'user-recent-imports.changed';
  ownerId: string;
  action: UserRecentImportsRealtimeAction;
  changedAt: string;
  detail?: Record<string, unknown>;
};

type UserRecentImportsRealtimeListener = (event: UserRecentImportsRealtimePayload) => void;

const EVENT_COLLECTION = 'user_recent_import_realtime_events';
const STORED_EVENT_LIMIT = 100;
let ablyRestClient: Ably.Rest | null = null;
let warnedAblyPublishUnauthorized = false;

type RealtimeGlobal = typeof globalThis & {
  __cs2tUserRecentImportsRealtimeSubscribers?: Map<string, Set<UserRecentImportsRealtimeListener>>;
};

const realtimeGlobal = globalThis as RealtimeGlobal;

function getSubscribers() {
  realtimeGlobal.__cs2tUserRecentImportsRealtimeSubscribers ??= new Map();
  return realtimeGlobal.__cs2tUserRecentImportsRealtimeSubscribers;
}

export function subscribeUserRecentImportsEvents(
  ownerId: string,
  listener: UserRecentImportsRealtimeListener
): () => void {
  const subscribers = getSubscribers();
  let ownerSubscribers = subscribers.get(ownerId);

  if (!ownerSubscribers) {
    ownerSubscribers = new Set();
    subscribers.set(ownerId, ownerSubscribers);
  }

  ownerSubscribers.add(listener);

  return () => {
    ownerSubscribers?.delete(listener);
    if (ownerSubscribers?.size === 0) {
      subscribers.delete(ownerId);
    }
  };
}

export async function publishUserRecentImportsChanged(
  ownerId: string,
  action: UserRecentImportsRealtimeAction,
  detail?: Record<string, unknown>
): Promise<void> {
  const event: UserRecentImportsRealtimePayload = {
    id: randomUUID(),
    type: 'user-recent-imports.changed',
    ownerId,
    action,
    changedAt: new Date().toISOString(),
    detail,
  };

  emitUserRecentImportsChanged(event);

  try {
    const db = await getDatabase();
    await db.collection(EVENT_COLLECTION).insertOne({
      ...event,
      createdAt: new Date(event.changedAt),
    });
  } catch (error) {
    console.error('Failed to persist user recent imports realtime event:', error);
  }

  await publishUserRecentImportsChangedToAbly(event);
}

export async function findStoredUserRecentImportsEvents(
  ownerId: string,
  after: Date
): Promise<UserRecentImportsRealtimePayload[]> {
  const db = await getDatabase();
  const docs = await db
    .collection(EVENT_COLLECTION)
    .find({ ownerId, createdAt: { $gt: after } })
    .sort({ createdAt: 1 })
    .limit(STORED_EVENT_LIMIT)
    .toArray();

  return docs
    .map((doc) => ({
      id: String(doc.id),
      type: 'user-recent-imports.changed' as const,
      ownerId: String(doc.ownerId),
      action: doc.action as UserRecentImportsRealtimeAction,
      changedAt: String(doc.changedAt),
      detail:
        doc.detail && typeof doc.detail === 'object' && !Array.isArray(doc.detail)
          ? (doc.detail as Record<string, unknown>)
          : undefined,
    }))
    .filter((event) => event.id && event.ownerId === ownerId && event.action);
}

function emitUserRecentImportsChanged(event: UserRecentImportsRealtimePayload): void {
  const ownerSubscribers = getSubscribers().get(event.ownerId);
  if (!ownerSubscribers || ownerSubscribers.size === 0) return;

  for (const listener of [...ownerSubscribers]) {
    try {
      listener(event);
    } catch (error) {
      console.error('User recent imports realtime listener failed:', error);
    }
  }
}

async function publishUserRecentImportsChangedToAbly(
  event: UserRecentImportsRealtimePayload
): Promise<void> {
  const client = getAblyRestClient();
  if (!client) return;

  try {
    await client.channels
      .get(getUserRecentImportsRealtimeChannelName(event.ownerId))
      .publish('user-recent-imports.changed', event);
  } catch (error) {
    if (isAblyPublishUnauthorized(error)) {
      if (!warnedAblyPublishUnauthorized) {
        warnedAblyPublishUnauthorized = true;
        console.warn(
          'ABLY_API_KEY is not allowed to publish recent import events. Recent import clients will continue through SSE/event-log fallback.'
        );
      }
      return;
    }
    console.error('Failed to publish user recent imports realtime event to Ably:', error);
  }
}

export function getUserRecentImportsRealtimeChannelName(ownerId: string): string {
  return `user:${ownerId}:recent-imports`;
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
