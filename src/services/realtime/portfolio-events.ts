import { randomUUID } from 'crypto';
import * as Ably from 'ably';
import { getDatabase } from '@/infrastructure/db/mongo-client';

export type PortfolioRealtimeAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'deleted_many'
  | 'imported'
  | 'synced'
  | 'prices_refreshed';

export type PortfolioRealtimeEvent = {
  id: string;
  type: 'portfolio.changed';
  ownerId: string;
  action: PortfolioRealtimeAction;
  changedAt: string;
  detail?: Record<string, unknown>;
};

type PortfolioRealtimeListener = (event: PortfolioRealtimeEvent) => void;

const EVENT_COLLECTION = 'portfolio_realtime_events';
const STORED_EVENT_LIMIT = 100;
let ablyRestClient: Ably.Rest | null = null;
let warnedAblyPublishUnauthorized = false;

type RealtimeGlobal = typeof globalThis & {
  __cs2tPortfolioRealtimeSubscribers?: Map<string, Set<PortfolioRealtimeListener>>;
};

const realtimeGlobal = globalThis as RealtimeGlobal;

function getSubscribers() {
  realtimeGlobal.__cs2tPortfolioRealtimeSubscribers ??= new Map();
  return realtimeGlobal.__cs2tPortfolioRealtimeSubscribers;
}

export function subscribePortfolioChanges(
  ownerId: string,
  listener: PortfolioRealtimeListener
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

export async function publishPortfolioChanged(
  ownerId: string,
  action: PortfolioRealtimeAction,
  detail?: Record<string, unknown>
): Promise<void> {
  const event: PortfolioRealtimeEvent = {
    id: randomUUID(),
    type: 'portfolio.changed',
    ownerId,
    action,
    changedAt: new Date().toISOString(),
    detail,
  };

  emitPortfolioChanged(event);

  try {
    const db = await getDatabase();
    await db.collection(EVENT_COLLECTION).insertOne({
      ...event,
      createdAt: new Date(event.changedAt),
    });
  } catch (error) {
    console.error('Failed to persist portfolio realtime event:', error);
  }

  await publishPortfolioChangedToAbly(event);
}

export async function findStoredPortfolioEvents(
  ownerId: string,
  after: Date
): Promise<PortfolioRealtimeEvent[]> {
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
      type: 'portfolio.changed' as const,
      ownerId: String(doc.ownerId),
      action: doc.action as PortfolioRealtimeAction,
      changedAt: String(doc.changedAt),
      detail:
        doc.detail && typeof doc.detail === 'object' && !Array.isArray(doc.detail)
          ? (doc.detail as Record<string, unknown>)
          : undefined,
    }))
    .filter((event) => event.id && event.ownerId === ownerId && event.action);
}

export async function hasStoredPortfolioEventsAfter(
  ownerId: string,
  after: Date
): Promise<boolean> {
  const db = await getDatabase();
  const doc = await db
    .collection(EVENT_COLLECTION)
    .findOne({ ownerId, createdAt: { $gt: after } }, { projection: { _id: 1 } });

  return Boolean(doc);
}

function emitPortfolioChanged(event: PortfolioRealtimeEvent): void {
  const ownerSubscribers = getSubscribers().get(event.ownerId);
  if (!ownerSubscribers || ownerSubscribers.size === 0) return;

  for (const listener of [...ownerSubscribers]) {
    try {
      listener(event);
    } catch (error) {
      console.error('Portfolio realtime listener failed:', error);
    }
  }
}

async function publishPortfolioChangedToAbly(event: PortfolioRealtimeEvent): Promise<void> {
  const client = getAblyRestClient();
  if (!client) return;

  try {
    await client.channels
      .get(getPortfolioRealtimeChannelName(event.ownerId))
      .publish('portfolio.changed', event);
  } catch (error) {
    if (isAblyPublishUnauthorized(error)) {
      if (!warnedAblyPublishUnauthorized) {
        warnedAblyPublishUnauthorized = true;
        console.warn(
          'ABLY_API_KEY is not allowed to publish portfolio realtime events. Portfolio clients will continue through SSE/event-log fallback.'
        );
      }
      return;
    }
    console.error('Failed to publish portfolio realtime event to Ably:', error);
  }
}

function getAblyRestClient(): Ably.Rest | null {
  const apiKey = process.env.ABLY_API_KEY?.trim();
  if (!apiKey) return null;

  ablyRestClient ??= new Ably.Rest({ key: apiKey });
  return ablyRestClient;
}

export function getPortfolioRealtimeChannelName(ownerId: string): string {
  return `portfolio:${ownerId}`;
}

function isAblyPublishUnauthorized(error: unknown): boolean {
  const maybeAblyError = error as { code?: unknown; statusCode?: unknown };
  return maybeAblyError.code === 40160 || maybeAblyError.statusCode === 401;
}
