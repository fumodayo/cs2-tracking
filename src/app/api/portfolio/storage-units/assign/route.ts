import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { getPortfolioOwnerId } from "@/services/auth-service";
import { ObjectId } from "mongodb";
import { STORAGE_UNIT_MAX_CAPACITY } from "@/domain/storage-unit";

export const dynamic = "force-dynamic";

type AssignItem = {
  caseId: string;
  marketHashName: string;
  quantity: number;
};

/**
 * POST /api/portfolio/storage-units/assign
 * Assign items to a Storage Unit.
 * Body: { storageUnitId: string, items: AssignItem[] }
 */
export async function POST(request: Request) {
  try {
    const ownerId = await getPortfolioOwnerId();
    const db = await getDatabase();
    const body = await request.json();
    const { storageUnitId, items } = body;

    if (!storageUnitId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { message: "Thiếu storageUnitId hoặc items." },
        { status: 400 },
      );
    }

    const collection = db.collection("storage_units");
    const doc = await collection.findOne({
      _id: new ObjectId(storageUnitId),
      ownerId,
    });

    if (!doc) {
      return NextResponse.json(
        { message: "Storage Unit không tồn tại." },
        { status: 404 },
      );
    }

    const existingItems: any[] = Array.isArray(doc.items) ? doc.items : [];
    const currentCount = existingItems.reduce(
      (sum: number, item: any) => sum + (Number(item.quantity) || 0),
      0,
    );
    const addingCount = items.reduce(
      (sum: number, item: AssignItem) => sum + (Number(item.quantity) || 0),
      0,
    );

    if (currentCount + addingCount > STORAGE_UNIT_MAX_CAPACITY) {
      return NextResponse.json(
        {
          message: `Storage Unit "${doc.name}" đã chứa ${currentCount} items. Không thể thêm ${addingCount} items (tối đa ${STORAGE_UNIT_MAX_CAPACITY}).`,
          currentCount,
          addingCount,
          maxCapacity: STORAGE_UNIT_MAX_CAPACITY,
        },
        { status: 400 },
      );
    }

    const now = new Date();
    const updatedItems = [...existingItems];

    for (const item of items) {
      if (
        !item.caseId ||
        !item.marketHashName ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0
      ) {
        continue;
      }

      const existingIdx = updatedItems.findIndex(
        (ei: any) => ei.caseId === item.caseId,
      );

      if (existingIdx >= 0) {
        updatedItems[existingIdx] = {
          ...updatedItems[existingIdx],
          quantity: updatedItems[existingIdx].quantity + item.quantity,
        };
      } else {
        updatedItems.push({
          caseId: item.caseId,
          marketHashName: item.marketHashName,
          quantity: item.quantity,
          addedAt: now,
        });
      }
    }

    await collection.updateOne(
      { _id: new ObjectId(storageUnitId) },
      { $set: { items: updatedItems, updatedAt: now } },
    );

    const newCount = updatedItems.reduce(
      (sum: number, item: any) => sum + (Number(item.quantity) || 0),
      0,
    );

    return NextResponse.json({
      message: `Đã thêm ${addingCount} items vào Storage Unit "${doc.name}".`,
      currentCount: newCount,
    });
  } catch (error) {
    console.error("Error assigning items to storage unit:", error);
    return NextResponse.json(
      { message: "Không thể thêm items vào Storage Unit." },
      { status: 500 },
    );
  }
}
