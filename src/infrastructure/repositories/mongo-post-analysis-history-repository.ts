import { type Document, type WithId } from "mongodb";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { toObjectId } from "@/infrastructure/db/mappers";
import type {
  PostAnalysisDto,
  PostAnalysisHistoryItemDto,
} from "@/types/post-analysis";

type SavePostAnalysisHistoryInput = {
  fingerprint: string;
  text: string;
  imageFileName?: string;
  imageCloudinaryUrl?: string;
  analysis: PostAnalysisDto;
};

export class MongoPostAnalysisHistoryRepository {
  private readonly collectionName = "post_analysis_history";

  async list(limit = 30): Promise<PostAnalysisHistoryItemDto[]> {
    const collection = await this.getCollection();
    const docs = await collection
      .find({})
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();
    return docs.map(mapPostAnalysisHistoryDocument);
  }

  async findByFingerprint(
    fingerprint: string,
  ): Promise<PostAnalysisHistoryItemDto | null> {
    const collection = await this.getCollection();
    const doc = await collection.findOne({ fingerprint });
    return doc ? mapPostAnalysisHistoryDocument(doc) : null;
  }

  async findByPostUrl(
    postUrl: string,
  ): Promise<PostAnalysisHistoryItemDto | null> {
    const collection = await this.getCollection();
    const doc = await collection.findOne({ "analysis.postUrl": postUrl });
    return doc ? mapPostAnalysisHistoryDocument(doc) : null;
  }

  async save(
    input: SavePostAnalysisHistoryInput,
  ): Promise<PostAnalysisHistoryItemDto> {
    const collection = await this.getCollection();
    const now = new Date();
    const result = await collection.findOneAndUpdate(
      { fingerprint: input.fingerprint },
      {
        $set: {
          text: input.text,
          imageFileName: input.imageFileName,
          imageCloudinaryUrl: input.imageCloudinaryUrl,
          analysis: input.analysis,
          updatedAt: now,
        },
        $setOnInsert: {
          fingerprint: input.fingerprint,
          createdAt: now,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );

    if (!result) {
      throw new Error("Failed to save post analysis history.");
    }

    return mapPostAnalysisHistoryDocument(result);
  }

  async touch(id: string): Promise<PostAnalysisHistoryItemDto | null> {
    const collection = await this.getCollection();
    const doc = await collection.findOneAndUpdate(
      { _id: toObjectId(id) },
      { $set: { updatedAt: new Date() } },
      { returnDocument: "after" },
    );

    return doc ? mapPostAnalysisHistoryDocument(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.deleteOne({ _id: toObjectId(id) });
    return result.deletedCount === 1;
  }

  private async getCollection() {
    const db = await getDatabase();
    const collection = db.collection(this.collectionName);
    await collection.createIndex({ fingerprint: 1 }, { unique: true });
    await collection.createIndex({ updatedAt: -1 });
    return collection;
  }
}

function mapPostAnalysisHistoryDocument(
  doc: WithId<Document>,
): PostAnalysisHistoryItemDto {
  return {
    id: doc._id.toString(),
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
    text: String(doc.text ?? ""),
    imageFileName: doc.imageFileName ? String(doc.imageFileName) : undefined,
    imageCloudinaryUrl: doc.imageCloudinaryUrl
      ? String(doc.imageCloudinaryUrl)
      : undefined,
    analysis: normalizeAnalysis(doc.analysis),
  };
}

function normalizeAnalysis(value: unknown): PostAnalysisDto {
  if (!isRecord(value)) {
    throw new Error("Invalid post analysis history document.");
  }

  return {
    itemSource: value.itemSource === "image" ? "image" : "text",
    cacheStatus:
      value.cacheStatus === "hit" || value.cacheStatus === "miss"
        ? value.cacheStatus
        : undefined,
    itemRate: Number(value.itemRate ?? 1),
    allRate: Number(value.allRate ?? 1),
    totalQuantity: Number(value.totalQuantity ?? 0),
    totalSteamValue: Number(value.totalSteamValue ?? 0),
    totalItemRateValue: Number(value.totalItemRateValue ?? 0),
    totalAllRateValue: Number(value.totalAllRateValue ?? 0),
    rows: Array.isArray(value.rows) ? value.rows.map(normalizeRow) : [],
    unknownItems: Array.isArray(value.unknownItems)
      ? value.unknownItems.map(normalizeUnknownItem)
      : [],
    imageCloudinaryUrl: value.imageCloudinaryUrl
      ? String(value.imageCloudinaryUrl)
      : undefined,
    author: value.author ? String(value.author) : undefined,
    postTime: value.postTime ? String(value.postTime) : undefined,
    postUrl: value.postUrl ? String(value.postUrl) : undefined,
    authorUrl: value.authorUrl ? String(value.authorUrl) : undefined,
    steamUrl: value.steamUrl ? String(value.steamUrl) : undefined,
  };
}

function normalizeRow(value: unknown): PostAnalysisDto["rows"][number] {
  if (!isRecord(value)) {
    throw new Error("Invalid post analysis row.");
  }

  return {
    inputName: String(value.inputName ?? ""),
    marketHashName: String(value.marketHashName ?? ""),
    name: String(value.name ?? ""),
    imageUrl: value.imageUrl ? String(value.imageUrl) : undefined,
    quantity: Number(value.quantity ?? 0),
    steamUnitPrice:
      value.steamUnitPrice === null || value.steamUnitPrice === undefined
        ? null
        : Number(value.steamUnitPrice),
    itemRateUnitPrice:
      value.itemRateUnitPrice === null || value.itemRateUnitPrice === undefined
        ? null
        : Number(value.itemRateUnitPrice),
    allRateTotalPrice:
      value.allRateTotalPrice === null || value.allRateTotalPrice === undefined
        ? null
        : Number(value.allRateTotalPrice),
  };
}

function normalizeUnknownItem(
  value: unknown,
): PostAnalysisDto["unknownItems"][number] {
  if (!isRecord(value)) {
    throw new Error("Invalid unknown post analysis item.");
  }

  return {
    inputName: String(value.inputName ?? ""),
    quantity: Number(value.quantity ?? 0),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
