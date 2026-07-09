import { NextRequest, NextResponse } from 'next/server';
import { createServices } from '@/infrastructure/container';
import { getPortfolioOwnerId } from '@/services/auth-service';
import { serializeReport } from '@/services/dto';
import { getDatabase } from '@/infrastructure/db/mongo-client';
import { ObjectId } from 'mongodb';
import { getErrorMessage } from '@/utils/error';
import { portfolioItemSchema } from '@/utils/validation';
import { STORAGE_UNIT_MAX_CAPACITY } from '@/domain/storage-unit';
import { getOwnerFilter } from '@/infrastructure/db/owner-filter';
import { publishPortfolioChanged } from '@/services/realtime/portfolio-events';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ownerId = await getPortfolioOwnerId();
    const { portfolioReportService } = createServices({ ownerId });
    const report = await portfolioReportService.buildReport({
      refreshStalePrices: false,
    });

    return NextResponse.json(serializeReport(report));
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, 'cannotProcessPortfolio') },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = portfolioItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });
    }
    const ownerId = await getPortfolioOwnerId();
    const { portfolioService, portfolioReportService, caseRepository, priceService } =
      createServices({ ownerId });

    let caseId = parsed.data.caseId;
    let caseItem = null;
    if (caseId.startsWith('ext_')) {
      const marketHashName = caseId.substring(4);
      caseItem = await caseRepository.findOrCreateByMarketHashName(marketHashName);
      caseId = caseItem.id;
    } else {
      caseItem = await caseRepository.findById(caseId);
    }

    let buyPrice = parsed.data.buyPrice ?? 0;
    let isTemporaryPrice = parsed.data.isTemporaryPrice === true;

    if ((!buyPrice || buyPrice <= 0) && caseItem) {
      const priceSnapshot = await priceService.getCurrentPrice(caseItem);
      if (priceSnapshot) {
        buyPrice = priceSnapshot.price;
        isTemporaryPrice = true;
      } else {
        buyPrice = 1000;
        isTemporaryPrice = true;
      }
    }

    const storageUnitId = parsed.data.storageUnitId;
    const finalQuantity = parsed.data.quantity;
    let note = parsed.data.note;

    const db = await getDatabase();
    const ownerFilter = getOwnerFilter(ownerId);
    let storageUnitUpdate: { id: string; items: Array<Record<string, unknown>> } | null = null;

    if (storageUnitId) {
      if (!ObjectId.isValid(storageUnitId)) {
        return NextResponse.json({ message: 'storageUnitNotFound' }, { status: 404 });
      }

      const suDoc = await db.collection('storage_units').findOne({
        _id: new ObjectId(storageUnitId),
        ...ownerFilter,
      });
      if (!suDoc) {
        return NextResponse.json({ message: 'storageUnitNotFound' }, { status: 404 });
      }

      if (suDoc && !note) {
        note = `Stored in Storage Unit: ${suDoc.name}`;
      }

      if (caseItem) {
        const existingItems = Array.isArray(suDoc.items) ? suDoc.items : [];
        const currentCount = existingItems.reduce(
          (sum: number, item: { quantity?: unknown }) => sum + (Number(item.quantity) || 0),
          0
        );

        if (currentCount + finalQuantity > STORAGE_UNIT_MAX_CAPACITY) {
          return NextResponse.json(
            {
              message: `storageUnitCapacityExceeded:name=${suDoc.name},currentCount=${currentCount},addingCount=${finalQuantity},maxCapacity=${STORAGE_UNIT_MAX_CAPACITY}`,
              currentCount,
              addingCount: finalQuantity,
              maxCapacity: STORAGE_UNIT_MAX_CAPACITY,
            },
            { status: 400 }
          );
        }

        const updatedItems = [...existingItems];
        const existingIdx = updatedItems.findIndex(
          (ei: { caseId: string }) => String(ei.caseId) === caseId
        );

        if (existingIdx >= 0) {
          updatedItems[existingIdx] = {
            ...updatedItems[existingIdx],
            quantity: Number(updatedItems[existingIdx].quantity || 0) + finalQuantity,
          };
        } else {
          updatedItems.push({
            caseId,
            marketHashName: caseItem.marketHashName,
            quantity: finalQuantity,
            addedAt: new Date(),
          });
        }

        storageUnitUpdate = { id: storageUnitId, items: updatedItems };
      }
    }

    await portfolioService.create({
      caseId,
      quantity: finalQuantity,
      buyPrice,
      buyDate: parsed.data.buyDate ?? new Date(),
      note,
      sourceAccounts: body.sourceAccounts ? body.sourceAccounts : undefined,
      tradeHoldUntil: body.tradeHoldUntil ? new Date(body.tradeHoldUntil) : undefined,
      isTemporaryPrice,
      storageUnitId,
      stickerPriceRate: parsed.data.stickerPriceRate,
      stickerBuyPriceRate: parsed.data.stickerBuyPriceRate,
      stickerScanTotalPrice: parsed.data.stickerScanTotalPrice,
      stickerScanPriceCapturedAt: parsed.data.stickerScanPriceCapturedAt,
    });

    if (storageUnitUpdate) {
      await db
        .collection('storage_units')
        .updateOne(
          { _id: new ObjectId(storageUnitUpdate.id), ...ownerFilter },
          { $set: { items: storageUnitUpdate.items, updatedAt: new Date() } }
        );
    }

    const report = await portfolioReportService.buildReport({
      refreshStalePrices: false,
    });
    await publishPortfolioChanged(ownerId, 'created', { count: 1 });
    return NextResponse.json(serializeReport(report), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, 'cannotProcessPortfolio') },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ message: 'selectItemsToDelete' }, { status: 400 });
    }

    const ownerId = await getPortfolioOwnerId();
    const { portfolioService, portfolioReportService } = createServices({
      ownerId,
    });
    const db = await getDatabase();

    const ownerFilter =
      ownerId === 'guest'
        ? { $or: [{ ownerId: 'guest' }, { ownerId: { $exists: false } }] }
        : { ownerId };

    // Tách ID thường khỏi ID ảo
    const normalIds: string[] = [];
    const virtualCaseIds: string[] = [];

    for (const id of ids) {
      if (typeof id === 'string' && id.startsWith('virtual_')) {
        virtualCaseIds.push(id.substring('virtual_'.length));
      } else if (typeof id === 'string' && ObjectId.isValid(id)) {
        normalIds.push(id);
      }
    }

    const suCollection = db.collection('storage_units');

    // 1. Xử lý xóa vật phẩm portfolio thường
    if (normalIds.length > 0) {
      const itemsToDelete = await db
        .collection('portfolio_items')
        .find({
          _id: { $in: normalIds.map((id) => new ObjectId(id)) },
          ...ownerFilter,
        })
        .toArray();

      for (const item of itemsToDelete) {
        if (item.storageUnitId && ObjectId.isValid(String(item.storageUnitId))) {
          const suId = String(item.storageUnitId);
          const qty = Number(item.quantity ?? 0);
          const caseId = String(item.caseId);

          const suDoc = await suCollection.findOne({
            _id: new ObjectId(suId),
            ...ownerFilter,
          });
          if (suDoc) {
            const existingItems = Array.isArray(suDoc.items) ? suDoc.items : [];
            const updatedItems = [...existingItems];
            const existingIdx = updatedItems.findIndex(
              (ei: { caseId: string }) => String(ei.caseId) === caseId
            );

            if (existingIdx >= 0) {
              const nextQty = Math.max(0, updatedItems[existingIdx].quantity - qty);
              if (nextQty === 0) {
                updatedItems.splice(existingIdx, 1);
              } else {
                updatedItems[existingIdx] = {
                  ...updatedItems[existingIdx],
                  quantity: nextQty,
                };
              }
              await suCollection.updateOne(
                { _id: new ObjectId(suId), ...ownerFilter },
                { $set: { items: updatedItems, updatedAt: new Date() } }
              );
            }
          }
        }
      }

      await portfolioService.deleteMany(normalIds);
    }

    // 2. Xử lý xóa vật phẩm ảo bằng cách xóa trực tiếp khỏi storage unit
    if (virtualCaseIds.length > 0) {
      const storageUnits = await suCollection.find(ownerFilter).toArray();

      for (const su of storageUnits) {
        if (!Array.isArray(su.items)) continue;

        let hasChanges = false;
        const updatedItems = su.items.filter((item: { caseId: string }) => {
          const isVirtualMatch = virtualCaseIds.includes(String(item.caseId));
          if (isVirtualMatch) {
            hasChanges = true;
            return false; // lọc bỏ/xóa khỏi storage unit
          }
          return true;
        });

        if (hasChanges) {
          await suCollection.updateOne(
            { _id: su._id, ...ownerFilter },
            { $set: { items: updatedItems, updatedAt: new Date() } }
          );
        }
      }
    }

    const report = await portfolioReportService.buildReport({
      refreshStalePrices: false,
    });
    await publishPortfolioChanged(ownerId, 'deleted_many', {
      count: normalIds.length + virtualCaseIds.length,
    });
    return NextResponse.json(serializeReport(report));
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, 'cannotProcessPortfolio') },
      { status: 400 }
    );
  }
}
