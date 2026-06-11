import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { getPortfolioOwnerId } from "@/services/auth-service";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

type MissingItemResolution = {
  caseId: string;
  marketHashName: string;
  missingQuantity: number;
  resolution: "storage_unit" | "traded" | "deleted" | "unknown";
  storageUnitId?: string;
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
        { message: "Không có resolutions nào để xử lý." },
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
          const suDoc = await storageUnitCol.findOne({
            _id: new ObjectId(storageUnitId),
            ownerId,
          });

          if (!suDoc) {
            results.push({
              marketHashName,
              resolution: action,
              success: false,
              error: "Storage Unit không tồn tại.",
            });
            continue;
          }

          const existingItems: any[] = Array.isArray(suDoc.items)
            ? suDoc.items
            : [];
          const currentCount = existingItems.reduce(
            (sum: number, item: any) => sum + (Number(item.quantity) || 0),
            0,
          );

          if (currentCount + missingQuantity > 1000) {
            results.push({
              marketHashName,
              resolution: action,
              success: false,
              error: `Storage Unit "${suDoc.name}" đã đầy (${currentCount}/1000).`,
            });
            continue;
          }

          const existingIdx = existingItems.findIndex(
            (ei: any) => ei.caseId === caseId,
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
            { _id: new ObjectId(storageUnitId) },
            { $set: { items: existingItems, updatedAt: now } },
          );

          results.push({ marketHashName, resolution: action, success: true });
        } catch (err) {
          results.push({
            marketHashName,
            resolution: action,
            success: false,
            error: err instanceof Error ? err.message : "Lỗi không xác định.",
          });
        }
      } else {
        // For traded/deleted/unknown: just log and acknowledge
        results.push({ marketHashName, resolution: action, success: true });
      }
    }

    return NextResponse.json({
      message: `Đã xử lý ${results.filter((r) => r.success).length}/${results.length} items.`,
      results,
    });
  } catch (error) {
    console.error("Error resolving missing items:", error);
    return NextResponse.json(
      { message: "Không thể xử lý items biến mất." },
      { status: 500 },
    );
  }
}
