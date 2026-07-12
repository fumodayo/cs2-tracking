export function getSavedBuffPriceCny(
  marketHashName: string | undefined,
  buffPricesCny: Record<string, number> | undefined
): number | null {
  if (!marketHashName) return null;

  const price = buffPricesCny?.[marketHashName];
  return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : null;
}
