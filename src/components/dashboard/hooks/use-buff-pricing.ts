import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientSessionUser } from '@/components/auth/use-session';
import { useLocalStorage } from '@/hooks/use-local-storage';
import {
  fetchUserBuffPrices,
  mergeUserBuffPrices,
  updateUserBuffPrice,
} from '@/lib/api-client/user-buff-prices-api';
import { subscribeUserBuffPricesChanges } from '@/lib/api-client/user-buff-prices-realtime';
import {
  clearLocalBuffPrices,
  hasBuffPrices,
  readLocalBuffPrices,
  writeLocalBuffPrices,
  type BuffPricesCny,
} from '@/utils/buff-prices';

interface UseBuffPricingOptions {
  user: ClientSessionUser | null;
  sessionLoading: boolean;
}

export function useBuffPricing({ user, sessionLoading }: UseBuffPricingOptions) {
  const [pricesCny, setPricesCnyState] = useState<BuffPricesCny>(() => readLocalBuffPrices());
  const pricesRef = useRef<BuffPricesCny>(pricesCny);
  const userId = user?.id ?? null;
  const [cnyToVndRate, setCnyToVndRate] = useLocalStorage<number>('cs2t_buffCnyToVndRate', 3600);

  useEffect(() => {
    pricesRef.current = pricesCny;
  }, [pricesCny]);

  useEffect(() => {
    if (sessionLoading) return;

    let cancelled = false;

    async function loadPrices() {
      if (!userId) {
        const localPrices = readLocalBuffPrices();
        pricesRef.current = localPrices;
        setPricesCnyState(localPrices);
        return;
      }

      try {
        const localPrices = readLocalBuffPrices();
        const serverPrices = hasBuffPrices(localPrices)
          ? await mergeUserBuffPrices(localPrices)
          : await fetchUserBuffPrices();

        if (!cancelled) {
          clearLocalBuffPrices();
          pricesRef.current = serverPrices;
          setPricesCnyState(serverPrices);
        }
      } catch (error) {
        console.error('Failed to load user BUFF prices:', error);
      }
    }

    void loadPrices();

    return () => {
      cancelled = true;
    };
  }, [sessionLoading, userId]);

  useEffect(() => {
    if (sessionLoading || !userId) return;

    let cancelled = false;
    const unsubscribe = subscribeUserBuffPricesChanges(() => {
      void fetchUserBuffPrices()
        .then((serverPrices) => {
          if (cancelled) return;
          clearLocalBuffPrices();
          pricesRef.current = serverPrices;
          setPricesCnyState(serverPrices);
        })
        .catch((error) => {
          console.error('Failed to refresh realtime BUFF prices:', error);
        });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [sessionLoading, userId]);

  const setPricesSnapshot = useCallback(
    (nextPrices: BuffPricesCny) => {
      pricesRef.current = nextPrices;
      setPricesCnyState(nextPrices);
      if (userId) {
        clearLocalBuffPrices();
      } else {
        writeLocalBuffPrices(nextPrices);
      }
    },
    [userId]
  );

  const updatePrice = useCallback(
    (marketHashName: string, priceCny: number | null) => {
      const next = { ...pricesRef.current };
      if (priceCny === null || priceCny <= 0) {
        delete next[marketHashName];
      } else {
        next[marketHashName] = priceCny;
      }
      setPricesSnapshot(next);

      if (userId) {
        void updateUserBuffPrice(marketHashName, priceCny).catch((error) => {
          console.error(`Failed to persist BUFF price for ${marketHashName}:`, error);
        });
      }
    },
    [setPricesSnapshot, userId]
  );

  const mergePrices = useCallback(
    (prices: BuffPricesCny) => {
      if (!hasBuffPrices(prices)) return;
      const next = { ...pricesRef.current, ...prices };
      setPricesSnapshot(next);

      if (userId) {
        void mergeUserBuffPrices(prices)
          .then((serverPrices) => {
            pricesRef.current = serverPrices;
            setPricesCnyState(serverPrices);
          })
          .catch((error) => {
            console.error('Failed to merge user BUFF prices:', error);
          });
      }
    },
    [setPricesSnapshot, userId]
  );

  const updateRate = (rate: number) => {
    setCnyToVndRate(rate);
  };

  return {
    pricesCny,
    cnyToVndRate,
    updatePrice,
    mergePrices,
    updateRate,
  };
}
