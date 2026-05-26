export type PortfolioItem = {
  id: string;
  caseId: string;
  quantity: number;
  buyPrice: number;
  buyCurrency: "VND";
  buyDate: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatePortfolioItemInput = {
  caseId: string;
  quantity: number;
  buyPrice: number;
  buyDate: Date;
  note?: string;
};

export type UpdatePortfolioItemInput = Partial<
  Pick<CreatePortfolioItemInput, "quantity" | "buyPrice" | "buyDate" | "note">
>;
