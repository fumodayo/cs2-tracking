import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { getPortfolioOwnerId } from "@/services/auth-service";
import { ObjectId } from "mongodb";
import { STORAGE_UNIT_MAX_CAPACITY } from "@/domain/storage-unit";
import { getOwnerFilter } from "@/infrastructure/db/owner-filter";

export const dynamic = "force-dynamic";

/**
 * GET /api/portfolio/storage-units
 * Returns all Storage Units for the current owner, optionally filtered by steamId64.
 */
export async function GET(request: Request) {
  try {
    const ownerId = await getPortfolioOwnerId();
    const db = await getDatabase();
    const url = new URL(request.url);
    const steamId64 = url.searchParams.get("steamId64");
    const shouldAggregate = url.searchParams.get("aggregate") === "1";

    const filter: Record<string, unknown> = { ...getOwnerFilter(ownerId) };
    if (steamId64) {
      filter.steamId64 = steamId64;
    }

    const docs = await db
      .collection("storage_units")
      .find(filter)
      .sort({ name: 1 })
      .toArray();

    // Fetch cases in bulk to resolve item names and images
    const caseIds = new Set<string>();
    const marketHashNames = new Set<string>();
    for (const doc of docs) {
      if (Array.isArray(doc.items)) {
        for (const item of doc.items) {
          if (item.caseId) caseIds.add(String(item.caseId));
          if (item.marketHashName)
            marketHashNames.add(String(item.marketHashName));
        }
      }
    }

    const casesFilter: { $or?: Array<Record<string, unknown>> } = {};
    const orClauses: Array<Record<string, unknown>> = [];
    if (caseIds.size > 0) {
      const oids = Array.from(caseIds)
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));
      if (oids.length > 0) {
        orClauses.push({ _id: { $in: oids } });
      }
    }
    if (marketHashNames.size > 0) {
      orClauses.push({ marketHashName: { $in: Array.from(marketHashNames) } });
    }

    let casesList: Array<Record<string, unknown>> = [];
    if (orClauses.length > 0) {
      casesFilter.$or = orClauses;
      casesList = (await db
        .collection("cases")
        .find(casesFilter)
        .toArray()) as unknown as Array<Record<string, unknown>>;
    }

    const casesById = new Map<string, Record<string, unknown>>();
    const casesByHashName = new Map<string, Record<string, unknown>>();
    for (const c of casesList) {
      casesById.set(String(c._id), c);
      if (typeof c.marketHashName === "string" && c.marketHashName) {
        casesByHashName.set(c.marketHashName, c);
      }
    }

    const storageUnits = docs.map((doc) => ({
      id: doc._id.toString(),
      ownerId: doc.ownerId,
      steamId64: doc.steamId64,
      assetId: doc.assetId,
      name: doc.name,
      iconUrl: doc.iconUrl ?? null,
      currentCount: computeCurrentCount(doc.items),
      maxCapacity: STORAGE_UNIT_MAX_CAPACITY,
      items: Array.isArray(doc.items)
        ? doc.items.map((item: Record<string, unknown>) => {
            const caseIdStr = String(item.caseId || "");
            const hashName = String(item.marketHashName || "");
            const matchedCase =
              casesById.get(caseIdStr) || casesByHashName.get(hashName);
            return {
              caseId: caseIdStr,
              marketHashName: hashName,
              name:
                matchedCase && typeof matchedCase.name === "string"
                  ? matchedCase.name
                  : hashName,
              imageUrl:
                matchedCase && typeof matchedCase.imageUrl === "string"
                  ? matchedCase.imageUrl
                  : null,
              rarity:
                matchedCase && typeof matchedCase.rarity === "object"
                  ? (matchedCase.rarity as {
                      name: string;
                      color: string;
                    } | null)
                  : null,
              quantity: Number(item.quantity || 0),
              storageUnitItems: [
                {
                  storageUnitId: doc._id.toString(),
                  quantity: Number(item.quantity || 0),
                },
              ],
              addedAt: item.addedAt,
            };
          })
        : [],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));

    return NextResponse.json({
      storageUnits:
        shouldAggregate && steamId64
          ? aggregateStorageUnits(storageUnits, steamId64)
          : storageUnits,
    });
  } catch (error) {
    console.error("Error fetching storage units:", error);
    return NextResponse.json(
      { message: "cannotLoadStorageUnits" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/portfolio/storage-units
 * Upsert Storage Units from scan results.
 * Body: { steamId64: string, storageUnits: Array<{ assetId, name, iconUrl }> }
 */
export async function POST(request: Request) {
  try {
    const ownerId = await getPortfolioOwnerId();
    const db = await getDatabase();
    const body = await request.json();
    const { steamId64, storageUnits } = body;

    if (!steamId64 || !Array.isArray(storageUnits)) {
      return NextResponse.json(
        { message: "missingSteamIdOrStorageUnits" },
        { status: 400 },
      );
    }

    const collection = db.collection("storage_units");
    const now = new Date();
    let upserted = 0;

    for (const su of storageUnits) {
      if (!su.assetId || !su.name) continue;

      await collection.updateOne(
        { ownerId, steamId64, assetId: String(su.assetId) },
        {
          $set: {
            ownerId,
            steamId64,
            assetId: String(su.assetId),
            name: String(su.name),
            iconUrl: su.iconUrl ?? null,
            updatedAt: now,
          },
          $setOnInsert: {
            items: [],
            createdAt: now,
          },
        },
        { upsert: true },
      );
      upserted++;
    }

    return NextResponse.json({
      message: `syncedStorageUnitsResult:count=${upserted}`,
      upserted,
    });
  } catch (error) {
    console.error("Error upserting storage units:", error);
    return NextResponse.json(
      { message: "cannotSyncStorageUnits" },
      { status: 500 },
    );
  }
}

function computeCurrentCount(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum: number, item: unknown) => {
    const quantity =
      typeof item === "object" && item !== null && "quantity" in item
        ? (item as Record<string, unknown>).quantity
        : 0;
    return sum + (Number(quantity) || 0);
  }, 0);
}

type StorageUnitResponseItem = {
  caseId: string;
  marketHashName: string;
  name: string;
  imageUrl: string | null;
  rarity: { name: string; color: string } | null;
  quantity: number;
  storageUnitItems?: Array<{
    storageUnitId: string;
    quantity: number;
  }>;
  addedAt?: unknown;
};

type StorageUnitResponse = {
  id: string;
  ownerId: unknown;
  steamId64: unknown;
  assetId: unknown;
  name: unknown;
  iconUrl: unknown;
  currentCount: number;
  maxCapacity: number;
  items: StorageUnitResponseItem[];
  createdAt: unknown;
  updatedAt: unknown;
};

function aggregateStorageUnits(
  storageUnits: StorageUnitResponse[],
  steamId64: string,
): StorageUnitResponse[] {
  if (storageUnits.length <= 1) return storageUnits;

  const itemMap = new Map<string, StorageUnitResponseItem>();
  for (const su of storageUnits) {
    for (const item of su.items) {
      const key = item.caseId || item.marketHashName;
      const existing = itemMap.get(key);
      if (existing) {
        existing.quantity += item.quantity;
        existing.storageUnitItems = [
          ...(existing.storageUnitItems ?? []),
          { storageUnitId: su.id, quantity: item.quantity },
        ];
      } else {
        itemMap.set(key, {
          ...item,
          storageUnitItems: [{ storageUnitId: su.id, quantity: item.quantity }],
        });
      }
    }
  }

  const first = storageUnits[0];
  return [
    {
      ...first,
      id: `storage-units:${steamId64}`,
      steamId64,
      assetId: null,
      name: "Storage Unit",
      iconUrl: null,
      currentCount: storageUnits.reduce((sum, su) => sum + su.currentCount, 0),
      maxCapacity: storageUnits.reduce((sum, su) => sum + su.maxCapacity, 0),
      items: Array.from(itemMap.values()).sort((firstItem, secondItem) =>
        firstItem.name.localeCompare(secondItem.name),
      ),
    },
  ];
}
