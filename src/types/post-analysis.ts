export type PostAnalysisRowDto = {
  inputName: string;
  marketHashName: string;
  name: string;
  imageUrl?: string;
  quantity: number;
  steamUnitPrice: number | null;
  itemRateUnitPrice: number | null;
  allRateTotalPrice: number | null;
};

export type UnknownPostItemDto = {
  inputName: string;
  quantity: number;
};

export type PostAnalysisDto = {
  itemRate: number;
  allRate: number;
  totalQuantity: number;
  totalSteamValue: number;
  totalItemRateValue: number;
  totalAllRateValue: number;
  rows: PostAnalysisRowDto[];
  unknownItems: UnknownPostItemDto[];
};
