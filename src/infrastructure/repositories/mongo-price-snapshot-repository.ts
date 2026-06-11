import type { CurrentPrice, PriceSnapshot } from "@/domain/price";
import type { PriceSnapshotRepository } from "@/domain/repositories";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { mapPriceDocument } from "@/infrastructure/db/mappers";
import type { Collection, Document, WithId } from "mongodb";

let snapshotIndexPromise: Promise<unknown> | null = null;

export class MongoPriceSnapshotRepository implements PriceSnapshotRepository {
  async findLatest(caseId: string): Promise<PriceSnapshot | null> {
    const db = await getDatabase();

    await ensureSnapshotIndex(db.collection("price_snapshots"));

    const doc = await db
      .collection("price_snapshots")
      .find({ caseId })
      .sort({ capturedAt: -1 })
      .limit(1)
      .next();

    return doc ? mapPriceDocument(doc) : null;
  }

  async findLatestMany(
    caseIds: string[],
  ): Promise<Map<string, PriceSnapshot>> {
    const uniqueCaseIds = Array.from(new Set(caseIds));
    if (uniqueCaseIds.length === 0) {
      return new Map();
    }

    const db = await getDatabase();
    const collection = db.collection("price_snapshots");
    await ensureSnapshotIndex(collection);

    const docs = await collection
      .aggregate<
        WithId<Document>
      >([
        { $match: { caseId: { $in: uniqueCaseIds } } },
        { $sort: { caseId: 1, capturedAt: -1 } },
        { $group: { _id: "$caseId", doc: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$doc" } }
      ])
      .toArray();

    return new Map(
      docs.map((doc) => {
        const snapshot = mapPriceDocument(doc);
        return [snapshot.caseId, snapshot];
      }),
    );
  }

  async findClosestBefore(
    caseId: string,
    date: Date,
  ): Promise<PriceSnapshot | null> {
    const db = await getDatabase();
    await ensureSnapshotIndex(db.collection("price_snapshots"));

    const doc = await db
      .collection("price_snapshots")
      .find({ caseId, capturedAt: { $lte: date } })
      .sort({ capturedAt: -1 })
      .limit(1)
      .next();

    return doc ? mapPriceDocument(doc) : null;
  }

  async findClosestBeforeMany(
    caseIds: string[],
    date: Date,
  ): Promise<Map<string, PriceSnapshot>> {
    const uniqueCaseIds = Array.from(new Set(caseIds));
    if (uniqueCaseIds.length === 0) {
      return new Map();
    }

    const db = await getDatabase();
    const collection = db.collection("price_snapshots");
    await ensureSnapshotIndex(collection);

    const docs = await collection
      .aggregate<
        WithId<Document>
      >([{ $match: { caseId: { $in: uniqueCaseIds }, capturedAt: { $lte: date } } }, { $sort: { caseId: 1, capturedAt: -1 } }, { $group: { _id: "$caseId", doc: { $first: "$$ROOT" } } }, { $replaceRoot: { newRoot: "$doc" } }])
      .toArray();

    return new Map(
      docs.map((doc) => {
        const snapshot = mapPriceDocument(doc);
        return [snapshot.caseId, snapshot];
      }),
    );
  }

  async create(input: CurrentPrice): Promise<PriceSnapshot> {
    const db = await getDatabase();
    const result = await db.collection("price_snapshots").insertOne(input);
    const doc = await db
      .collection("price_snapshots")
      .findOne({ _id: result.insertedId });

    if (!doc) {
      throw new Error("Failed to create price snapshot.");
    }

    return mapPriceDocument(doc);
  }
}

function ensureSnapshotIndex(collection: Collection) {
  snapshotIndexPromise ??= collection.createIndex({
    caseId: 1,
    capturedAt: -1,
  });
  return snapshotIndexPromise;
}
