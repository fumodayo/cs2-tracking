import { ObjectId } from 'mongodb';
import type { CaseItem } from '@/domain/case-item';
import type { CaseRepository } from '@/domain/repositories';
import { enrichMissingCaseImages } from '@/infrastructure/cases/case-image-cache';
import { DEFAULT_CASES } from '@/infrastructure/cases/default-cases';
import { getDatabase } from '@/infrastructure/db/mongo-client';
import { mapCaseDocument, toObjectId } from '@/infrastructure/db/mappers';

let caseSeedPromise: Promise<void> | null = null;

export class MongoCaseRepository implements CaseRepository {
  async ensureSeeded(): Promise<void> {
    caseSeedPromise ??= this.seedDefaults().catch((error) => {
      caseSeedPromise = null;
      throw error;
    });

    return caseSeedPromise;
  }

  private async seedDefaults(): Promise<void> {
    const db = await getDatabase();
    const collection = db.collection('cases');

    await collection.createIndex({ marketHashName: 1 }, { unique: true });
    await collection.createIndex({ name: 'text', marketHashName: 'text' });

    // Upsert toàn bộ item mặc định — thêm item còn thiếu mà không chạm item đã có
    const ops = DEFAULT_CASES.map((caseItem) => ({
      updateOne: {
        filter: { marketHashName: caseItem.marketHashName },
        update: {
          $setOnInsert: {
            ...caseItem,
            isActive: true,
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    await collection.bulkWrite(ops, { ordered: false }).catch(() => {});
  }

  async search(query: string): Promise<CaseItem[]> {
    await this.ensureSeeded();

    const db = await getDatabase();
    const normalizedQuery = query.trim();
    const filter = normalizedQuery
      ? {
          isActive: true,
          $or: [
            { name: { $regex: normalizedQuery, $options: 'i' } },
            { marketHashName: { $regex: normalizedQuery, $options: 'i' } },
          ],
        }
      : { isActive: true };

    const docs = await db.collection('cases').find(filter).sort({ name: 1 }).limit(25).toArray();

    return this.enrichMissingMetadata(docs.map(mapCaseDocument));
  }

  async findById(id: string): Promise<CaseItem | null> {
    await this.ensureSeeded();

    const db = await getDatabase();
    const doc = await db.collection('cases').findOne({ _id: toObjectId(id), isActive: true });
    if (!doc) {
      return null;
    }

    const [caseItem] = await this.enrichMissingMetadata([mapCaseDocument(doc)]);
    return caseItem;
  }

  async findByMarketHashName(marketHashName: string): Promise<CaseItem | null> {
    await this.ensureSeeded();

    const db = await getDatabase();
    const normalizedMarketHashName = normalizeMarketHashName(marketHashName);
    const doc = await db.collection('cases').findOne({
      isActive: true,
      marketHashName: {
        $regex: `^${escapeRegExp(normalizedMarketHashName)}$`,
        $options: 'i',
      },
    });

    if (!doc) {
      return null;
    }

    const [caseItem] = await this.enrichMissingMetadata([mapCaseDocument(doc)]);
    return caseItem;
  }

  async findByMarketHashNames(marketHashNames: string[]): Promise<Map<string, CaseItem>> {
    await this.ensureSeeded();

    const normalizedMarketHashNames = Array.from(
      new Set(marketHashNames.map(normalizeMarketHashName).filter((name) => name.length > 0))
    );
    if (normalizedMarketHashNames.length === 0) {
      return new Map();
    }

    const db = await getDatabase();
    const docs = await db
      .collection('cases')
      .find({
        isActive: true,
        marketHashName: { $in: normalizedMarketHashNames },
      })
      .collation({ locale: 'en', strength: 2 })
      .toArray();

    const cases = await this.enrichMissingMetadata(docs.map(mapCaseDocument));
    return new Map(
      cases.map((caseItem) => [getMarketHashNameLookupKey(caseItem.marketHashName), caseItem])
    );
  }

  async findOrCreateByMarketHashName(marketHashName: string): Promise<CaseItem> {
    const existing = await this.findByMarketHashName(marketHashName);
    if (existing) {
      return existing;
    }

    const normalizedMarketHashName = normalizeMarketHashName(marketHashName);
    const now = new Date();
    const db = await getDatabase();
    const collection = db.collection('cases');

    await collection.updateOne(
      { marketHashName: normalizedMarketHashName },
      {
        $set: {
          name: normalizedMarketHashName,
          marketHashName: normalizedMarketHashName,
          isActive: true,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );

    const doc = await collection.findOne({
      marketHashName: normalizedMarketHashName,
      isActive: true,
    });
    if (!doc) {
      throw new Error(`cannotCreateCase:name=${normalizedMarketHashName}`);
    }

    const [caseItem] = await this.enrichMissingMetadata([mapCaseDocument(doc)]);
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
      .collection('cases')
      .find({ _id: { $in: objectIds }, isActive: true })
      .toArray();

    return this.enrichMissingMetadata(docs.map(mapCaseDocument));
  }

  private async enrichMissingMetadata(cases: CaseItem[]): Promise<CaseItem[]> {
    await Promise.all([enrichMissingCaseImages(cases), this.enrichMissingRarities(cases)]);
    return cases;
  }

  private async enrichMissingRarities(cases: CaseItem[]): Promise<void> {
    const missingRarityCases = cases.filter((caseItem) => !caseItem.rarity);
    if (missingRarityCases.length === 0) {
      return;
    }

    const db = await getDatabase();

    await Promise.all(
      missingRarityCases.map(async (caseItem) => {
        const rarity = await findCachedRarity(db, caseItem.marketHashName);
        if (!rarity) {
          return;
        }

        caseItem.rarity = rarity;

        await db.collection('cases').updateOne(
          { _id: toObjectId(caseItem.id) },
          {
            $set: {
              rarity,
              updatedAt: new Date(),
            },
          }
        );
      })
    );
  }
}

async function findCachedRarity(
  db: Awaited<ReturnType<typeof getDatabase>>,
  marketHashName: string
): Promise<CaseItem['rarity'] | undefined> {
  const doc = await db.collection('inventory_scan_cache').findOne(
    {
      'items.caseItem.marketHashName': marketHashName,
      'items.rarity': { $exists: true },
    },
    {
      projection: {
        items: {
          $elemMatch: {
            'caseItem.marketHashName': marketHashName,
            rarity: { $exists: true },
          },
        },
      },
    }
  );

  const rarity = Array.isArray(doc?.items) ? doc.items[0]?.rarity : undefined;
  if (
    typeof rarity?.name === 'string' &&
    typeof rarity?.color === 'string' &&
    /^#[0-9a-f]{6}$/i.test(rarity.color)
  ) {
    return { name: rarity.name, color: rarity.color };
  }

  return undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeMarketHashName(value: string): string {
  const trimmed = value.trim();

  try {
    return decodeURIComponent(trimmed).trim();
  } catch {
    return trimmed;
  }
}

function getMarketHashNameLookupKey(value: string): string {
  return normalizeMarketHashName(value).toLowerCase();
}
