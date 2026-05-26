import type { CurrentPrice, PriceSnapshot } from "@/domain/price";
import type { PriceSnapshotRepository } from "@/domain/repositories";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { mapPriceDocument } from "@/infrastructure/db/mappers";

export class MongoPriceSnapshotRepository implements PriceSnapshotRepository {
  async findLatest(caseId: string): Promise<PriceSnapshot | null> {
    const db = await getDatabase();

    await db.collection("price_snapshots").createIndex({ caseId: 1, capturedAt: -1 });

    const doc = await db
      .collection("price_snapshots")
      .find({ caseId })
      .sort({ capturedAt: -1 })
      .limit(1)
      .next();

    return doc ? mapPriceDocument(doc) : null;
  }

  async findClosestBefore(caseId: string, date: Date): Promise<PriceSnapshot | null> {
    const db = await getDatabase();
    const doc = await db
      .collection("price_snapshots")
      .find({ caseId, capturedAt: { $lte: date } })
      .sort({ capturedAt: -1 })
      .limit(1)
      .next();

    return doc ? mapPriceDocument(doc) : null;
  }

  async create(input: CurrentPrice): Promise<PriceSnapshot> {
    const db = await getDatabase();
    const result = await db.collection("price_snapshots").insertOne(input);
    const doc = await db.collection("price_snapshots").findOne({ _id: result.insertedId });

    if (!doc) {
      throw new Error("Failed to create price snapshot.");
    }

    return mapPriceDocument(doc);
  }
}
