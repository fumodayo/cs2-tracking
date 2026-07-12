import { parseViFloat } from '@/utils/format';

export function calculateLotTotal(
  quantityValue: string,
  unitPriceValue: string | number
): number | null {
  const quantity = parseViFloat(quantityValue);
  const unitPrice =
    typeof unitPriceValue === 'number' ? unitPriceValue : parseViFloat(unitPriceValue);

  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
    return null;
  }

  return Math.round(quantity * unitPrice);
}
