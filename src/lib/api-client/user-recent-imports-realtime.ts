'use client';

import * as Ably from 'ably';

type UserRecentImportsRealtimeTokenResponse = {
  tokenDetails?: Ably.TokenDetails;
  channelName?: string;
};

export function subscribeUserRecentImportsChanges(onChanged: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  let disposed = false;
  let sseSource: EventSource | null = null;
  let client: Ably.Realtime | null = null;
  let channel: Ably.RealtimeChannel | null = null;
  let changeTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleChanged = () => {
    if (changeTimer) {
      clearTimeout(changeTimer);
    }

    changeTimer = setTimeout(() => {
      changeTimer = null;
      if (!disposed) {
        onChanged();
      }
    }, 250);
  };

  const startSseFallback = () => {
    if (disposed || sseSource) return;

    const source = new EventSource('/api/realtime/user-recent-imports');
    sseSource = source;
    source.addEventListener('user-recent-imports-changed', () => {
      scheduleChanged();
    });
  };

  const startRealtime = async () => {
    try {
      const tokenResponse = await fetch('/api/realtime/ably-token?userRecentImports=1', {
        cache: 'no-store',
      });
      if (!tokenResponse.ok || disposed) return;

      const realtimeConfig = (await tokenResponse.json()) as UserRecentImportsRealtimeTokenResponse;
      if (!realtimeConfig.tokenDetails || !realtimeConfig.channelName || disposed) return;

      client = new Ably.Realtime({
        tokenDetails: realtimeConfig.tokenDetails,
        transports: ['web_socket'],
      });
      channel = client.channels.get(realtimeConfig.channelName);
      let ablyConnected = false;
      let fallbackTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        fallbackTimer = null;
        if (!disposed && !ablyConnected) {
          client?.close();
        }
      }, 5_000);

      client.connection.on('connected', () => {
        ablyConnected = true;
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
      });

      client.connection.on((stateChange) => {
        if (stateChange.current === 'failed' || stateChange.current === 'suspended') {
          if (fallbackTimer) {
            clearTimeout(fallbackTimer);
            fallbackTimer = null;
          }
          client?.close();
        }
      });

      await channel.subscribe('user-recent-imports.changed', () => {
        scheduleChanged();
      });
    } catch {
      // Recent import history still refreshes through direct API responses when realtime is unavailable.
    }
  };

  startSseFallback();
  void startRealtime();

  return () => {
    disposed = true;
    if (changeTimer) {
      clearTimeout(changeTimer);
    }
    if (channel) {
      void channel.unsubscribe('user-recent-imports.changed');
    }
    sseSource?.close();
    client?.close();
  };
}
