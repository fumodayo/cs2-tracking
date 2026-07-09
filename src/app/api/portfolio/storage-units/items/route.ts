import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/infrastructure/db/mongo-client';
import { getPortfolioOwnerId } from '@/services/auth-service';
import { getOwnerFilter } from '@/infrastructure/db/owner-filter';
import { publishPortfolioChanged } from '@/services/realtime/portfolio-events';

export const dynamic = 'force-dynamic';

type DeleteStorageUnitItemInput = {
  storageUnitId: string;
  caseId?: string;
  marketHashName?: string;
};

type StorageUnitItem = {
  caseId?: string;
  marketHashName?: string;
  quantity?: number;
  addedAt?: Date;
};

/**
 *
 *
 * DELETE /api/portfolio/storage-units/items
 * Body: { items: Array<{ storageUnitId, caseId?, marketHashName? }> }
 *
 *
 */
export async function DELETE(request: Request) {
  try {
    const ownerId = await getPortfolioOwnerId();
    const db = await getDatabase();
    const body = await request.json().catch(() => ({}));
    const items = body.items as DeleteStorageUnitItemInput[] | undefined;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: 'missingStorageUnitItemDeletePayload' }, { status: 400 });
    }

    const targetsByStorageUnit = new Map<string, DeleteStorageUnitItemInput[]>();
    for (const item of items) {
      if (!item.storageUnitId || !ObjectId.isValid(item.storageUnitId)) {
        continue;
      }
      if (!item.caseId && !item.marketHashName) {
        continue;
      }

      const existing = targetsByStorageUnit.get(item.storageUnitId) ?? [];
      existing.push(item);
      targetsByStorageUnit.set(item.storageUnitId, existing);
    }

    if (targetsByStorageUnit.size === 0) {
      return NextResponse.json({ message: 'missingStorageUnitItemDeletePayload' }, { status: 400 });
    }

    const collection = db.collection('storage_units');
    const now = new Date();
    let removedCount = 0;
    let touchedStorageUnits = 0;

    for (const [storageUnitId, targets] of targetsByStorageUnit) {
      const doc = await collection.findOne({
        _id: new ObjectId(storageUnitId),
        ...getOwnerFilter(ownerId),
      });

      if (!doc) continue;

      const existingItems: StorageUnitItem[] = Array.isArray(doc.items) ? doc.items : [];
      const remainingItems = existingItems.filter((existingItem) => {
        const shouldRemove = targets.some((target) => {
          const caseMatches = target.caseId && String(existingItem.caseId || '') === target.caseId;
          const marketHashMatches =
            target.marketHashName &&
            String(existingItem.marketHashName || '') === target.marketHashName;
          return Boolean(caseMatches || marketHashMatches);
        });

        if (shouldRemove) {
          removedCount += Number(existingItem.quantity || 0);
        }
        return !shouldRemove;
      });

      if (remainingItems.length === existingItems.length) continue;

      await collection.updateOne(
        { _id: new ObjectId(storageUnitId), ...getOwnerFilter(ownerId) },
        { $set: { items: remainingItems, updatedAt: now } }
      );
      touchedStorageUnits++;
    }

    if (touchedStorageUnits > 0) {
      await publishPortfolioChanged(ownerId, 'updated', {
        entity: 'storage_units',
        removedCount,
        touchedStorageUnits,
      });
    }

    return NextResponse.json({
      message: `storageUnitItemsRemoved:count=${removedCount}`,
      removedCount,
      touchedStorageUnits,
    });
  } catch (error) {
    console.error('Error deleting storage unit items:', error);
    return NextResponse.json({ message: 'cannotRemoveStorageUnitItems' }, { status: 500 });
  }
}
