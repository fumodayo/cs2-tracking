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
  itemSource: "text" | "image";
  cacheStatus?: "hit" | "miss";
  itemRate: number;
  allRate: number;
  totalQuantity: number;
  totalSteamValue: number;
  totalItemRateValue: number;
  totalAllRateValue: number;
  rows: PostAnalysisRowDto[];
  unknownItems: UnknownPostItemDto[];
  imageCloudinaryUrl?: string;
  author?: string;
  postTime?: string;
  postUrl?: string;
  authorUrl?: string;
  steamUrl?: string;
};

export type PostAnalysisHistoryItemDto = {
  id: string;
  createdAt: string;
  updatedAt: string;
  text: string;
  imageFileName?: string;
  imageCloudinaryUrl?: string;
  analysis: PostAnalysisDto;
};
