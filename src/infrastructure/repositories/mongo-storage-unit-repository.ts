import type { StorageUnit } from "@/domain/storage-unit";
import type { StorageUnitRepository } from "@/domain/repositories";
import { getDatabase } from "@/infrastructure/db/mongo-client";

export class MongoStorageUnitRepository implements StorageUnitRepository {
  constructor(private readonly ownerId = "guest") {}

  async list(): Promise<StorageUnit[]> {
    const db = await getDatabase();
    const ownerFilter =
      this.ownerId === "guest"
        ? { $or: [{ ownerId: "guest" }, { ownerId: { $exists: false } }] }
        : { ownerId: this.ownerId };

    const docs = await db.collection("storage_units").find(ownerFilter).toArray();

    return docs.map((doc) => ({
      id: doc._id.toString(),
      name: String(doc.name || ""),
      steamId64: String(doc.steamId64 || ""),
      assetId: String(doc.assetId || ""),
      iconUrl: doc.iconUrl ? String(doc.iconUrl) : null,
      currentCount: Number(doc.currentCount || 0),
      ownerId: String(doc.ownerId || "guest"),
      items: Array.isArray(doc.items)
        ? doc.items.map((item) => ({
            caseId: String(item.caseId || ""),
            marketHashName: String(item.marketHashName || ""),
            quantity: Number(item.quantity || 0),
            addedAt: item.addedAt instanceof Date ? item.addedAt : new Date(),
          }))
        : [],
      createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(),
      updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(),
    }));
  }
}
