'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  collectAccessoryMarketHashNames,
  getAccessoryTotalPrice,
  type AccessoryWithMarketHashName,
} from '@/utils/accessories';

type AccessoryPrice = {
  marketHashName: string;
  price: number;
};

const EMPTY_PRICE_MAP = new Map<string, number>();

export function useAccessoryPrices(...collections: Array<AccessoryWithMarketHashName[]>) {
  const dependencyKey = collections
    .map((collection) => collection.map((item) => item.marketHashName ?? '').join('\u0001'))
    .join('\u0002');

  const marketHashNames = useMemo(
    () => collectAccessoryMarketHashNames(...collections),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dependencyKey]
  );

  const pricesQuery = useQuery({
    queryKey: ['sticker-charm-prices', marketHashNames],
    queryFn: async () => {
      const res = await fetch('/api/inventory/sticker-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketHashNames }),
      });
      if (!res.ok) throw new Error('failedToFetchStickerPrices');
      const data = (await res.json()) as { results?: AccessoryPrice[] };
      return new Map((data.results ?? []).map((item) => [item.marketHashName, item.price]));
    },
    enabled: marketHashNames.length > 0,
    staleTime: 15 * 60 * 1000,
  });

  const priceMap = pricesQuery.data ?? EMPTY_PRICE_MAP;
  const totalPrice = getAccessoryTotalPrice(collections.flat(), priceMap);

  return {
    marketHashNames,
    priceMap,
    pricesQuery,
    totalPrice,
  };
}
