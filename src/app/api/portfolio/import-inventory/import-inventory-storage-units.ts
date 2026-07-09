import { ObjectId } from 'mongodb';
import { getDatabase } from '@/infrastructure/db/mongo-client';
import type { StorageUnitAssignment } from './import-inventory-types';

type StorageUnitItem = {
  caseId?: string;
  marketHashName?: string;
  quantity: number;
  addedAt?: Date;
};

export async function assignManualItemsToStorageUnits(
  assignments: StorageUnitAssignment[],
  ownerId: string
) {
  if (assignments.length === 0) {
    return;
  }

  try {
    const db = await getDatabase();
    const suCollection = db.collection('storage_units');

    for (const assign of assignments) {
      // Chỉ gắn vào storage unit thuộc owner portfolio hiện tại.
      const suDoc = await suCollection.findOne({
        _id: new ObjectId(assign.storageUnitId),
        ownerId,
      });
      if (!suDoc) {
        continue;
      }

      const existingItems = Array.isArray(suDoc.items) ? suDoc.items : [];
      const updatedItems = [...existingItems] as StorageUnitItem[];
      const existingIdx = updatedItems.findIndex((ei) => ei.caseId === assign.caseId);

      // Gộp các assignment cùng case trong storage unit thay vì tạo dòng trùng.
      if (existingIdx >= 0) {
        updatedItems[existingIdx] = {
          ...updatedItems[existingIdx],
          quantity: updatedItems[existingIdx].quantity + assign.quantity,
        };
      } else {
        updatedItems.push({
          caseId: assign.caseId,
          marketHashName: assign.marketHashName,
          quantity: assign.quantity,
          addedAt: new Date(),
        });
      }

      await suCollection.updateOne(
        { _id: new ObjectId(assign.storageUnitId), ownerId },
        { $set: { items: updatedItems, updatedAt: new Date() } }
      );
    }
  } catch (suError) {
    console.error('Failed to assign manual items to storage units:', suError);
  }
}
