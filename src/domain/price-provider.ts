import type { CaseItem } from "./case-item";
import type { CurrentPrice } from "./price";

export interface PriceProvider {
  getCurrentPrice(
    caseItem: CaseItem,
    options?: { preferFallback?: boolean },
  ): Promise<CurrentPrice | null>;
}
