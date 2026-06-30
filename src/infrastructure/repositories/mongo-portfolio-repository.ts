import type {
  CreatePortfolioItemInput,
  PortfolioItem,
  UpdatePortfolioItemInput,
} from "@/domain/portfolio-item";
import type { PortfolioRepository } from "@/domain/repositories";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { mapPortfolioDocument, toObjectId } from "@/infrastructure/db/mappers";

export class MongoPortfolioRepository implements PortfolioRepository {
  constructor(private readonly ownerId = "guest") {}

  async list(): Promise<PortfolioItem[]> {
    const db = await getDatabase();
    const docs = await db
      .collection("portfolio_items")
      .find(this.getOwnerFilter())
      .sort({ createdAt: -1 })
      .toArray();
    return docs.map(mapPortfolioDocument);
  }

  async create(input: CreatePortfolioItemInput): Promise<PortfolioItem> {
    const db = await getDatabase();
    const now = new Date();
    const result = await db.collection("portfolio_items").insertOne({
      caseId: input.caseId,
      quantity: input.quantity,
      buyPrice: input.buyPrice,
      buyCurrency: "VND",
      buyDate: input.buyDate,
      note: input.note,
      sourceAccounts: input.sourceAccounts ?? [],
      tradeHoldUntil: input.tradeHoldUntil,
      isTemporaryPrice: input.isTemporaryPrice,
      storageUnitId: input.storageUnitId,
      dopplerPhase: input.dopplerPhase,
      inspectLink: input.inspectLink,
      patternInfo: input.patternInfo,
      stickerPriceRate: input.stickerPriceRate,
      stickerBuyPriceRate: input.stickerBuyPriceRate,
      stickerBuyPriceAdd:
        input.stickerBuyPriceAdd ??
        (input.stickerScanTotalPrice !== undefined &&
        input.stickerBuyPriceRate !== undefined
          ? Math.round(
              (input.stickerScanTotalPrice * input.stickerBuyPriceRate) / 100,
            )
          : undefined),
      stickerScanTotalPrice: input.stickerScanTotalPrice,
      stickerScanPriceCapturedAt: input.stickerScanPriceCapturedAt,
      ownerId: this.ownerId,
      createdAt: now,
      updatedAt: now,
    });

    const doc = await db
      .collection("portfolio_items")
      .findOne({ _id: result.insertedId });
    if (!doc) {
      throw new Error("Failed to create portfolio item.");
    }

    return mapPortfolioDocument(doc);
  }

  async createMany(
    inputs: CreatePortfolioItemInput[],
  ): Promise<PortfolioItem[]> {
    if (inputs.length === 0) return [];
    const db = await getDatabase();
    const now = new Date();
    const docs = inputs.map((input) => ({
      caseId: input.caseId,
      quantity: input.quantity,
      buyPrice: input.buyPrice,
      buyCurrency: "VND",
      buyDate: input.buyDate,
      note: input.note,
      sourceAccounts: input.sourceAccounts ?? [],
      tradeHoldUntil: input.tradeHoldUntil,
      isTemporaryPrice: input.isTemporaryPrice,
      storageUnitId: input.storageUnitId,
      dopplerPhase: input.dopplerPhase,
      inspectLink: input.inspectLink,
      patternInfo: input.patternInfo,
      stickerPriceRate: input.stickerPriceRate,
      stickerBuyPriceRate: input.stickerBuyPriceRate,
      stickerBuyPriceAdd:
        input.stickerBuyPriceAdd ??
        (input.stickerScanTotalPrice !== undefined &&
        input.stickerBuyPriceRate !== undefined
          ? Math.round(
              (input.stickerScanTotalPrice * input.stickerBuyPriceRate) / 100,
            )
          : undefined),
      stickerScanTotalPrice: input.stickerScanTotalPrice,
      stickerScanPriceCapturedAt: input.stickerScanPriceCapturedAt,
      ownerId: this.ownerId,
      createdAt: now,
      updatedAt: now,
    }));

    const result = await db.collection("portfolio_items").insertMany(docs);
    const insertedIds = Object.values(result.insertedIds);
    const insertedDocs = await db
      .collection("portfolio_items")
      .find({
        _id: { $in: insertedIds },
      })
      .toArray();

    return insertedDocs.map(mapPortfolioDocument);
  }

  async update(
    id: string,
    input: UpdatePortfolioItemInput,
  ): Promise<PortfolioItem | null> {
    const db = await getDatabase();
    const result = await db.collection("portfolio_items").findOneAndUpdate(
      { _id: toObjectId(id), ...this.getOwnerFilter() },
      {
        $set: {
          ...input,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );

    return result ? mapPortfolioDocument(result) : null;
  }

  async delete(id: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db
      .collection("portfolio_items")
      .deleteOne({ _id: toObjectId(id), ...this.getOwnerFilter() });
    return result.deletedCount === 1;
  }

  async deleteMany(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    const db = await getDatabase();
    const objectIds = ids.map((id) => toObjectId(id));
    const result = await db
      .collection("portfolio_items")
      .deleteMany({ _id: { $in: objectIds }, ...this.getOwnerFilter() });
    return result.deletedCount === ids.length;
  }

  private getOwnerFilter() {
    if (this.ownerId === "guest") {
      return {
        $or: [{ ownerId: "guest" }, { ownerId: { $exists: false } }],
      };
    }

    return { ownerId: this.ownerId };
  }
}
