import { useLocalStorage } from "@/hooks/use-local-storage";

export function useBuffPricing() {
  const [pricesCny, setPricesCny] = useLocalStorage<Record<string, number>>(
    "cs2t_buffPricesCny",
    {}
  );
  const [cnyToVndRate, setCnyToVndRate] = useLocalStorage<number>(
    "cs2t_buffCnyToVndRate",
    3600
  );

  const updatePrice = (marketHashName: string, priceCny: number | null) => {
    setPricesCny((prev) => {
      const next = { ...prev };
      if (priceCny === null || priceCny <= 0) {
        delete next[marketHashName];
      } else {
        next[marketHashName] = priceCny;
      }
      return next;
    });
  };

  const updateRate = (rate: number) => {
    setCnyToVndRate(rate);
  };

  return {
    pricesCny,
    cnyToVndRate,
    updatePrice,
    updateRate,
    setPricesCny,
  };
}
