import { NextRequest, NextResponse } from "next/server";
import { createServices } from "@/infrastructure/container";
import { getPortfolioOwnerId } from "@/services/auth-service";
import { serializeReport } from "@/services/dto";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { ObjectId } from "mongodb";
import { getErrorMessage } from "@/utils/error";

export const dynamic = "force-dynamic";

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
      { message: getErrorMessage(error, "Không thể xử lý portfolio.") },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      portfolioService,
      portfolioReportService,
      caseRepository,
      priceService,
    } = createServices({ ownerId: await getPortfolioOwnerId() });

    let caseId = String(body.caseId ?? "");
    let caseItem = null;
    if (caseId.startsWith("ext_")) {
      const marketHashName = caseId.substring(4);
      caseItem =
        await caseRepository.findOrCreateByMarketHashName(marketHashName);
      caseId = caseItem.id;
    } else {
      caseItem = await caseRepository.findById(caseId);
    }

    let buyPrice = Number(body.buyPrice);
    let isTemporaryPrice = body.isTemporaryPrice === true;

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

    const storageUnitId = body.storageUnitId
      ? String(body.storageUnitId)
      : undefined;
    const finalQuantity = Number(body.quantity);
    let note = body.note ? String(body.note) : undefined;

    const db = await getDatabase();
    if (storageUnitId && ObjectId.isValid(storageUnitId)) {
      const suDoc = await db.collection("storage_units").findOne({
        _id: new ObjectId(storageUnitId),
      });
      if (suDoc && !note) {
        note = `Cất trong Storage Unit: ${suDoc.name}`;
      }
    }

    await portfolioService.create({
      caseId,
      quantity: finalQuantity,
      buyPrice,
      buyDate: new Date(body.buyDate ?? Date.now()),
      note,
      sourceAccounts: body.sourceAccounts ? body.sourceAccounts : undefined,
      tradeHoldUntil: body.tradeHoldUntil
        ? new Date(body.tradeHoldUntil)
        : undefined,
      isTemporaryPrice,
      storageUnitId,
    });

    if (storageUnitId && ObjectId.isValid(storageUnitId) && caseItem) {
      const suCollection = db.collection("storage_units");
      const suDoc = await suCollection.findOne({
        _id: new ObjectId(storageUnitId),
        ownerId: await getPortfolioOwnerId(),
      });
      if (suDoc) {
        const existingItems = Array.isArray(suDoc.items) ? suDoc.items : [];
        const updatedItems = [...existingItems];
        const existingIdx = updatedItems.findIndex(
          (ei: { caseId: string }) => ei.caseId === caseId,
        );

        if (existingIdx >= 0) {
          updatedItems[existingIdx] = {
            ...updatedItems[existingIdx],
            quantity:
              updatedItems[existingIdx].quantity + Number(body.quantity),
          };
        } else {
          updatedItems.push({
            caseId,
            marketHashName: caseItem.marketHashName,
            quantity: Number(body.quantity),
            addedAt: new Date(),
          });
        }
        await suCollection.updateOne(
          { _id: new ObjectId(storageUnitId) },
          { $set: { items: updatedItems, updatedAt: new Date() } },
        );
      }
    }

    const report = await portfolioReportService.buildReport({
      refreshStalePrices: false,
    });
    return NextResponse.json(serializeReport(report), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "Không thể xử lý portfolio.") },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { message: "Vui lòng chọn các item cần xóa." },
        { status: 400 },
      );
    }

    const ownerId = await getPortfolioOwnerId();
    const { portfolioService, portfolioReportService } = createServices({
      ownerId,
    });
    const db = await getDatabase();

    const ownerFilter =
      ownerId === "guest"
        ? { $or: [{ ownerId: "guest" }, { ownerId: { $exists: false } }] }
        : { ownerId };

    // Separate normal IDs from virtual IDs
    const normalIds: string[] = [];
    const virtualCaseIds: string[] = [];

    for (const id of ids) {
      if (typeof id === "string" && id.startsWith("virtual_")) {
        virtualCaseIds.push(id.substring("virtual_".length));
      } else if (typeof id === "string" && ObjectId.isValid(id)) {
        normalIds.push(id);
      }
    }

    const suCollection = db.collection("storage_units");

    // 1. Process normal portfolio item deletions
    if (normalIds.length > 0) {
      const itemsToDelete = await db
        .collection("portfolio_items")
        .find({
          _id: { $in: normalIds.map((id) => new ObjectId(id)) },
          ...ownerFilter,
        })
        .toArray();

      for (const item of itemsToDelete) {
        if (
          item.storageUnitId &&
          ObjectId.isValid(String(item.storageUnitId))
        ) {
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
              (ei: { caseId: string }) => String(ei.caseId) === caseId,
            );

            if (existingIdx >= 0) {
              const nextQty = Math.max(
                0,
                updatedItems[existingIdx].quantity - qty,
              );
              if (nextQty === 0) {
                updatedItems.splice(existingIdx, 1);
              } else {
                updatedItems[existingIdx] = {
                  ...updatedItems[existingIdx],
                  quantity: nextQty,
                };
              }
              await suCollection.updateOne(
                { _id: new ObjectId(suId) },
                { $set: { items: updatedItems, updatedAt: new Date() } },
              );
            }
          }
        }
      }

      await portfolioService.deleteMany(normalIds);
    }

    // 2. Process virtual item deletions (remove from storage units directly)
    if (virtualCaseIds.length > 0) {
      const storageUnits = await suCollection.find(ownerFilter).toArray();

      for (const su of storageUnits) {
        if (!Array.isArray(su.items)) continue;

        let hasChanges = false;
        const updatedItems = su.items.filter((item: { caseId: string }) => {
          const isVirtualMatch = virtualCaseIds.includes(String(item.caseId));
          if (isVirtualMatch) {
            hasChanges = true;
            return false; // filter out/remove from storage unit
          }
          return true;
        });

        if (hasChanges) {
          await suCollection.updateOne(
            { _id: su._id },
            { $set: { items: updatedItems, updatedAt: new Date() } },
          );
        }
      }
    }

    const report = await portfolioReportService.buildReport({
      refreshStalePrices: false,
    });
    return NextResponse.json(serializeReport(report));
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "Không thể xử lý portfolio.") },
      { status: 400 },
    );
  }
}


