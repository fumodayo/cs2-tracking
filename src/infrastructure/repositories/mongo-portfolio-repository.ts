import type {
  CreatePortfolioItemInput,
  PortfolioItem,
  UpdatePortfolioItemInput,
} from "@/domain/portfolio-item";
import type { PortfolioRepository } from "@/domain/repositories";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { mapPortfolioDocument, toObjectId } from "@/infrastructure/db/mappers";

export class MongoPortfolioRepository implements PortfolioRepository {
  async list(): Promise<PortfolioItem[]> {
    const db = await getDatabase();
    const docs = await db.collection("portfolio_items").find({}).sort({ createdAt: -1 }).toArray();
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
      createdAt: now,
      updatedAt: now,
    });

    const doc = await db.collection("portfolio_items").findOne({ _id: result.insertedId });
    if (!doc) {
      throw new Error("Failed to create portfolio item.");
    }

    return mapPortfolioDocument(doc);
  }

  async update(id: string, input: UpdatePortfolioItemInput): Promise<PortfolioItem | null> {
    const db = await getDatabase();
    const result = await db.collection("portfolio_items").findOneAndUpdate(
      { _id: toObjectId(id) },
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
    const result = await db.collection("portfolio_items").deleteOne({ _id: toObjectId(id) });
    return result.deletedCount === 1;
  }
}
