import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/services/auth-service';
import {
  findStoredUserRecentImportsEvents,
  subscribeUserRecentImportsEvents,
  type UserRecentImportsRealtimePayload,
} from '@/services/realtime/user-recent-import-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HEARTBEAT_INTERVAL_MS = 25_000;
const EVENT_LOG_POLL_INTERVAL_MS = 1_500;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }

  const ownerId = `google:${user.id}`;
  const encoder = new TextEncoder();
  let cleanup: () => void = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let lastSeenAt = new Date(Date.now() - 1000);
      let closed = false;
      let polling = false;
      const seenEventIds = new Set<string>();

      const send = (eventName: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const sendRecentImportsEvent = (event: UserRecentImportsRealtimePayload) => {
        if (seenEventIds.has(event.id)) return;
        seenEventIds.add(event.id);
        lastSeenAt = new Date(event.changedAt);
        send('user-recent-imports-changed', event);
      };

      const unsubscribe = subscribeUserRecentImportsEvents(ownerId, (event) => {
        sendRecentImportsEvent(event);
      });
      const heartbeat = setInterval(() => {
        send('heartbeat', { at: new Date().toISOString() });
      }, HEARTBEAT_INTERVAL_MS);
      const eventLogPoll = setInterval(async () => {
        if (polling || closed) return;
        polling = true;
        try {
          const events = await findStoredUserRecentImportsEvents(ownerId, lastSeenAt);
          for (const event of events) {
            sendRecentImportsEvent(event);
          }
        } catch (error) {
          console.error('Failed to poll recent imports realtime events:', error);
        } finally {
          polling = false;
        }
      }, EVENT_LOG_POLL_INTERVAL_MS);

      cleanup = () => {
        closed = true;
        clearInterval(heartbeat);
        clearInterval(eventLogPoll);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // The stream may already be closed by the client disconnect.
        }
      };

      request.signal.addEventListener('abort', cleanup, { once: true });
      send('connected', { at: new Date().toISOString() });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
