export type AccountChangeDetail = {
  steamId64: string;
  name: string;
  change: number;
  previousQuantity: number;
  currentQuantity: number;
};

export type MissingItem = {
  caseId: string;
  marketHashName: string;
  caseName: string;
  imageUrl: string | null;
  previousQuantity: number;
  currentQuantity: number;
  missingQuantity: number;
  accounts?: AccountChangeDetail[];
};

export type ExtraItem = {
  caseId: string;
  marketHashName: string;
  caseName: string;
  imageUrl: string | null;
  previousQuantity: number;
  currentQuantity: number;
  extraQuantity: number;
  accounts?: AccountChangeDetail[];
  breakdown?: {
    tradeable: number;
    onMarket: number;
    tradeProtected: number;
    hold: number;
  };
};

export type SyncStorageUnit = {
  id: string;
  name: string;
  steamId64: string;
  currentCount: number;
};
