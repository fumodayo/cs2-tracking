import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { getPortfolioOwnerId } from "@/services/auth-service";
import { ObjectId } from "mongodb";
import { getOwnerFilter } from "@/infrastructure/db/owner-filter";
import { STORAGE_UNIT_MAX_CAPACITY } from "@/domain/storage-unit";

export const dynamic = "force-dynamic";

type MissingItemResolution = {
  caseId: string;
  marketHashName: string;
  missingQuantity: number;
  resolution: "storage_unit" | "traded" | "deleted" | "unknown";
  storageUnitId?: string;
};

type StorageUnitItem = {
  caseId: string;
  marketHashName: string;
  quantity: number;
  addedAt?: Date;
};

/**
 * POST /api/portfolio/storage-units/resolve-missing
 * Resolve missing items detected during sync.
 * Body: { resolutions: MissingItemResolution[] }
 */
export async function POST(request: Request) {
  try {
    const ownerId = await getPortfolioOwnerId();
    const db = await getDatabase();
    const body = await request.json();
    const { resolutions } = body;

    if (!Array.isArray(resolutions) || resolutions.length === 0) {
      return NextResponse.json(
        { message: "noResolutionsToProcess" },
        { status: 400 },
      );
    }

    const storageUnitCol = db.collection("storage_units");
    const now = new Date();
    const results: Array<{
      marketHashName: string;
      resolution: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const resolution of resolutions as MissingItemResolution[]) {
      const {
        caseId,
        marketHashName,
        missingQuantity,
        resolution: action,
        storageUnitId,
      } = resolution;

      if (action === "storage_unit" && storageUnitId) {
        try {
          if (!ObjectId.isValid(storageUnitId)) {
            results.push({
              marketHashName,
              resolution: action,
              success: false,
              error: "storageUnitNotFound",
            });
            continue;
          }

          const suDoc = await storageUnitCol.findOne({
            _id: new ObjectId(storageUnitId),
            ...getOwnerFilter(ownerId),
          });

          if (!suDoc) {
            results.push({
              marketHashName,
              resolution: action,
              success: false,
              error: "storageUnitNotFound",
            });
            continue;
          }

          const existingItems: StorageUnitItem[] = Array.isArray(suDoc.items)
            ? suDoc.items
            : [];
          const currentCount = existingItems.reduce(
            (sum, item) => sum + (Number(item.quantity) || 0),
            0,
          );

          if (currentCount + missingQuantity > STORAGE_UNIT_MAX_CAPACITY) {
            results.push({
              marketHashName,
              resolution: action,
              success: false,
              error: `storageUnitFull:name=${suDoc.name},currentCount=${currentCount},maxCapacity=${STORAGE_UNIT_MAX_CAPACITY}`,
            });
            continue;
          }

          const existingIdx = existingItems.findIndex(
            (ei) => ei.caseId === caseId,
          );
          if (existingIdx >= 0) {
            existingItems[existingIdx].quantity += missingQuantity;
          } else {
            existingItems.push({
              caseId,
              marketHashName,
              quantity: missingQuantity,
              addedAt: now,
            });
          }

          await storageUnitCol.updateOne(
            { _id: new ObjectId(storageUnitId), ...getOwnerFilter(ownerId) },
            { $set: { items: existingItems, updatedAt: now } },
          );

          results.push({ marketHashName, resolution: action, success: true });
        } catch (err) {
          results.push({
            marketHashName,
            resolution: action,
            success: false,
            error: err instanceof Error ? err.message : "unknownError",
          });
        }
      } else {
        // For traded/deleted/unknown: just log and acknowledge
        results.push({ marketHashName, resolution: action, success: true });
      }
    }

    return NextResponse.json({
      message: `processedMissingItemsResult:successCount=${results.filter((r) => r.success).length},totalCount=${results.length}`,
      results,
    });
  } catch (error) {
    console.error("Error resolving missing items:", error);
    return NextResponse.json(
      { message: "cannotResolveMissingItems" },
      { status: 500 },
    );
  }
}
