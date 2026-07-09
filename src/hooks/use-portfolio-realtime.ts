'use client';

import * as Ably from 'ably';
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PORTFOLIO_QUERY_KEY } from '@/lib/api-client/portfolio-api';
import { STEAM_ACCOUNTS_QUERY_KEY } from '@/lib/api-client/steam-accounts-api';

type PortfolioRealtimePayload = {
  id?: string;
  type?: 'portfolio.changed';
  ownerId?: string;
  action?: string;
};

export function usePortfolioRealtime(enabled: boolean, ownerId?: string) {
  const queryClient = useQueryClient();
  const lastEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    let disposed = false;
    let sseSource: EventSource | null = null;
    let ablyClient: Ably.Realtime | null = null;
    let ablyChannel: Ably.RealtimeChannel | null = null;
    let invalidationTimer: ReturnType<typeof setTimeout> | null = null;

    const invalidatePortfolioQueries = () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['portfolio-storage-units'] });
      void queryClient.invalidateQueries({ queryKey: STEAM_ACCOUNTS_QUERY_KEY });
    };

    const schedulePortfolioInvalidation = () => {
      if (invalidationTimer) {
        clearTimeout(invalidationTimer);
      }

      invalidationTimer = setTimeout(() => {
        invalidationTimer = null;
        if (!disposed) {
          invalidatePortfolioQueries();
        }
      }, 250);
    };

    const handlePortfolioChanged = (payload: PortfolioRealtimePayload | null) => {
      if (!payload || payload.type !== 'portfolio.changed') return;
      if (payload.id && payload.id === lastEventIdRef.current) return;

      lastEventIdRef.current = payload.id ?? null;
      schedulePortfolioInvalidation();
    };

    const startSseFallback = () => {
      if (disposed || sseSource) return;
      const source = new EventSource('/api/realtime/portfolio');
      sseSource = source;
      source.addEventListener('portfolio-changed', (event) => {
        handlePortfolioChanged(parsePayload((event as MessageEvent<string>).data));
      });
    };

    const startAbly = async () => {
      if (!ownerId) {
        startSseFallback();
        return;
      }

      try {
        const tokenResponse = await fetch('/api/realtime/ably-token', { cache: 'no-store' });
        if (!tokenResponse.ok) {
          startSseFallback();
          return;
        }

        const tokenDetails = (await tokenResponse.json()) as Ably.TokenDetails;
        if (disposed) return;

        const client = new Ably.Realtime({ tokenDetails });
        const channel = client.channels.get(`portfolio:${ownerId}`);
        ablyClient = client;
        ablyChannel = channel;

        await channel.subscribe('portfolio.changed', (message) => {
          handlePortfolioChanged(message.data as PortfolioRealtimePayload);
        });
      } catch (error) {
        console.error('Failed to connect Ably portfolio realtime, falling back to SSE:', error);
        startSseFallback();
      }
    };

    void startAbly();

    return () => {
      disposed = true;
      if (invalidationTimer) {
        clearTimeout(invalidationTimer);
      }
      sseSource?.close();
      if (ablyChannel) {
        ablyChannel.unsubscribe('portfolio.changed');
      }
      ablyClient?.close();
    };
  }, [enabled, ownerId, queryClient]);
}

function parsePayload(value: string): PortfolioRealtimePayload | null {
  try {
    return JSON.parse(value) as PortfolioRealtimePayload;
  } catch {
    return null;
  }
}
