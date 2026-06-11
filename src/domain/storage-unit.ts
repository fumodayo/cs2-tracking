export const STORAGE_UNIT_MAX_CAPACITY = 1000;

export type StorageUnit = {
  id: string;
  ownerId: string;
  steamId64: string;
  assetId: string;
  name: string;
  iconUrl: string | null;
  currentCount: number;
  items: StorageUnitItem[];
  createdAt: Date;
  updatedAt: Date;
};

export type StorageUnitItem = {
  caseId: string;
  marketHashName: string;
  quantity: number;
  addedAt: Date;
};

export type StorageUnitInfo = {
  assetId: string;
  name: string;
  iconUrl: string | null;
};
