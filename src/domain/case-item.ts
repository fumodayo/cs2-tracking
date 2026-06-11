export type CaseItem = {
  id: string;
  name: string;
  marketHashName: string;
  imageUrl?: string;
  rarity?: {
    name: string;
    color: string;
  };
  isActive: boolean;
};

export type CaseSearchResult = Pick<
  CaseItem,
  "id" | "name" | "marketHashName" | "imageUrl"
>;
