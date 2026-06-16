export type PortfolioItem = {
  id: string;
  caseId: string;
  quantity: number;
  buyPrice: number;
  buyCurrency: "VND";
  buyDate: Date;
  note?: string;
  sourceAccounts?: PortfolioSourceAccount[];
  tradeHoldUntil?: Date;
  isTemporaryPrice?: boolean;
  storageUnitId?: string;
  storageUnitQuantity?: number;
  storageUnitDetails?: Array<{
    storageUnitId: string;
    storageUnitName: string;
    quantity: number;
    steamId64?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
};

export type PortfolioSourceAccount = {
  steamId64: string;
  name: string;
  breakdown?: {
    tradeable: number;
    onMarket: number;
    tradeProtected: number;
    hold: number;
    holdDetails?: Array<{
      quantity: number;
      holdDays: number;
    }>;
  };
};

export type CreatePortfolioItemInput = {
  caseId: string;
  quantity: number;
  buyPrice: number;
  buyDate: Date;
  note?: string;
  sourceAccounts?: PortfolioSourceAccount[];
  tradeHoldUntil?: Date;
  isTemporaryPrice?: boolean;
  storageUnitId?: string;
};

export type UpdatePortfolioItemInput = Partial<
  Pick<
    CreatePortfolioItemInput,
    | "quantity"
    | "buyPrice"
    | "buyDate"
    | "note"
    | "tradeHoldUntil"
    | "isTemporaryPrice"
    | "sourceAccounts"
    | "storageUnitId"
  >
>;
