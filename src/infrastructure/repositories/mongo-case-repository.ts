import { ObjectId } from "mongodb";
import type { CaseItem } from "@/domain/case-item";
import type { CaseRepository } from "@/domain/repositories";
import { DEFAULT_CASES } from "@/infrastructure/cases/default-cases";
import { getSteamCaseImageUrl } from "@/infrastructure/cases/steam-case-image-provider";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { mapCaseDocument, toObjectId } from "@/infrastructure/db/mappers";

export class MongoCaseRepository implements CaseRepository {
  async ensureSeeded(): Promise<void> {
    const db = await getDatabase();
    const collection = db.collection("cases");

    await collection.createIndex({ marketHashName: 1 }, { unique: true });
    await collection.createIndex({ name: "text", marketHashName: "text" });

    if ((await collection.estimatedDocumentCount()) > 0) {
      return;
    }

    await collection.insertMany(
      DEFAULT_CASES.map((caseItem) => ({
        ...caseItem,
        isActive: true,
        createdAt: new Date(),
      })),
      { ordered: false },
    );
  }

  async search(query: string): Promise<CaseItem[]> {
    await this.ensureSeeded();

    const db = await getDatabase();
    const normalizedQuery = query.trim();
    const filter = normalizedQuery
      ? {
          isActive: true,
          $or: [
            { name: { $regex: normalizedQuery, $options: "i" } },
            { marketHashName: { $regex: normalizedQuery, $options: "i" } },
          ],
        }
      : { isActive: true };

    const docs = await db
      .collection("cases")
      .find(filter)
      .sort({ name: 1 })
      .limit(25)
      .toArray();

    return this.enrichMissingImages(docs.map(mapCaseDocument));
  }

  async findById(id: string): Promise<CaseItem | null> {
    await this.ensureSeeded();

    const db = await getDatabase();
    const doc = await db.collection("cases").findOne({ _id: toObjectId(id), isActive: true });
    if (!doc) {
      return null;
    }

    const [caseItem] = await this.enrichMissingImages([mapCaseDocument(doc)]);
    return caseItem;
  }

  async findByIds(ids: string[]): Promise<CaseItem[]> {
    await this.ensureSeeded();

    const objectIds = ids.filter(ObjectId.isValid).map((id) => new ObjectId(id));
    if (objectIds.length === 0) {
      return [];
    }

    const db = await getDatabase();
    const docs = await db
      .collection("cases")
      .find({ _id: { $in: objectIds }, isActive: true })
      .toArray();

    return this.enrichMissingImages(docs.map(mapCaseDocument));
  }

  private async enrichMissingImages(cases: CaseItem[]): Promise<CaseItem[]> {
    const missingImageCases = cases.filter((caseItem) => !caseItem.imageUrl);
    if (missingImageCases.length === 0) {
      return cases;
    }

    const db = await getDatabase();

    await Promise.all(
      missingImageCases.map(async (caseItem) => {
        const imageUrl = await getSteamCaseImageUrl(caseItem.marketHashName);
        if (!imageUrl) {
          return;
        }

        caseItem.imageUrl = imageUrl;

        await db.collection("cases").updateOne(
          { _id: toObjectId(caseItem.id) },
          {
            $set: {
              imageUrl,
              updatedAt: new Date(),
            },
          },
        );
      }),
    );

    return cases;
  }
}
