export type FormValues = {
  quantity: string;
  buyPrice: string;
  buyDate: string;
  buffPrice: string;
  buffRate: string;
  accountId: string;
  storageUnitId: string;
  itemState: "tradeable" | "hold" | "protected";
  holdDays: string;
};
