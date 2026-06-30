import { NextRequest, NextResponse } from "next/server";
import type { UpdatePortfolioItemInput } from "@/domain/portfolio-item";
import { getErrorMessage } from "@/utils/error";
import { createServices } from "@/infrastructure/container";
import { getPortfolioOwnerId } from "@/services/auth-service";
import { serializeReport } from "@/services/dto";
import { ObjectId } from "mongodb";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { STORAGE_UNIT_MAX_CAPACITY } from "@/domain/storage-unit";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const ownerId = await getPortfolioOwnerId();
    const { portfolioService, portfolioReportService } = createServices({
      ownerId,
    });
    const db = await getDatabase();

    const ownerFilter =
      ownerId === "guest"
        ? { $or: [{ ownerId: "guest" }, { ownerId: { $exists: false } }] }
        : { ownerId };

    const oldItem = await db
      .collection("portfolio_items")
      .findOne({ _id: new ObjectId(id), ...ownerFilter });

    if (!oldItem) {
      return NextResponse.json(
        { message: "itemNotFound" },
        { status: 404 },
      );
    }

    const oldQty = Number(oldItem.quantity ?? 0);
    const newQty = body.quantity !== undefined ? Number(body.quantity) : oldQty;
    const oldSuId = oldItem.storageUnitId
      ? String(oldItem.storageUnitId)
      : undefined;
    const newSuId =
      body.storageUnitId !== undefined
        ? body.storageUnitId
          ? String(body.storageUnitId)
          : undefined
        : oldSuId;
    const caseId = String(oldItem.caseId);

    const caseItem = await db
      .collection("cases")
      .findOne({ _id: new ObjectId(caseId) });

    const input: UpdatePortfolioItemInput = {};
    if (body.quantity !== undefined) input.quantity = Number(body.quantity);
    if (body.buyPrice !== undefined) {
      input.buyPrice = Number(body.buyPrice);
      input.isTemporaryPrice = false;
    }
    if (body.buyDate !== undefined) input.buyDate = new Date(body.buyDate);
    if (body.note !== undefined) input.note = String(body.note);
    if (body.sourceAccounts !== undefined)
      input.sourceAccounts = body.sourceAccounts;
    if (body.storageUnitId !== undefined)
      input.storageUnitId = body.storageUnitId || undefined;
    if (body.tradeHoldUntil !== undefined) {
      input.tradeHoldUntil = body.tradeHoldUntil
        ? new Date(body.tradeHoldUntil)
        : undefined;
    }
    if (body.dopplerPhase !== undefined) input.dopplerPhase = body.dopplerPhase;
    if (body.inspectLink !== undefined) input.inspectLink = body.inspectLink;
    if (body.patternInfo !== undefined) input.patternInfo = body.patternInfo;
    if (body.stickerPriceRate !== undefined) {
      const stickerPriceRate = Number(body.stickerPriceRate);
      input.stickerPriceRate = Number.isFinite(stickerPriceRate)
        ? Math.max(0, stickerPriceRate)
        : 0;
    }
    if (body.stickerBuyPriceRate !== undefined) {
      const stickerBuyPriceRate = Number(body.stickerBuyPriceRate);
      input.stickerBuyPriceRate = Number.isFinite(stickerBuyPriceRate)
        ? Math.max(0, stickerBuyPriceRate)
        : 0;
    }
    if (body.stickerScanTotalPrice !== undefined) {
      const stickerScanTotalPrice = Number(body.stickerScanTotalPrice);
      input.stickerScanTotalPrice = Number.isFinite(stickerScanTotalPrice)
        ? Math.max(0, stickerScanTotalPrice)
        : undefined;
    }
    if (body.stickerScanPriceCapturedAt !== undefined) {
      input.stickerScanPriceCapturedAt = body.stickerScanPriceCapturedAt
        ? new Date(body.stickerScanPriceCapturedAt)
        : undefined;
    }
    if (
      input.stickerBuyPriceRate !== undefined ||
      input.stickerScanTotalPrice !== undefined
    ) {
      const nextBuyRate =
        input.stickerBuyPriceRate ??
        (oldItem.stickerBuyPriceRate !== undefined
          ? Number(oldItem.stickerBuyPriceRate)
          : undefined);
      const nextScanTotal =
        input.stickerScanTotalPrice ??
        (oldItem.stickerScanTotalPrice !== undefined
          ? Number(oldItem.stickerScanTotalPrice)
          : undefined);
      input.stickerBuyPriceAdd =
        nextBuyRate !== undefined && nextScanTotal !== undefined
          ? Math.round((Math.max(0, nextScanTotal) * Math.max(0, nextBuyRate)) / 100)
          : undefined;
    }

    // Adjust storage unit items
    const suCollection = db.collection("storage_units");
    const adjustStorageUnitItem = async (suId: string, qtyDelta: number) => {
      if (qtyDelta === 0) return;
      if (!ObjectId.isValid(suId)) {
        if (qtyDelta > 0) throw new Error("storageUnitNotFound");
        return;
      }

      const suDoc = await suCollection.findOne({
        _id: new ObjectId(suId),
        ...ownerFilter,
      });
      if (!suDoc) {
        if (qtyDelta > 0) throw new Error("storageUnitNotFound");
        return;
      }

      const existingItems = Array.isArray(suDoc.items) ? suDoc.items : [];
      const currentCount = existingItems.reduce(
        (sum: number, item: { quantity?: unknown }) =>
          sum + (Number(item.quantity) || 0),
        0,
      );

      if (qtyDelta > 0 && currentCount + qtyDelta > STORAGE_UNIT_MAX_CAPACITY) {
        throw new Error(
          `storageUnitCapacityExceeded:name=${suDoc.name},currentCount=${currentCount},addingCount=${qtyDelta},maxCapacity=${STORAGE_UNIT_MAX_CAPACITY}`,
        );
      }

      const updatedItems = [...existingItems];
      const existingIdx = updatedItems.findIndex(
        (ei: { caseId: unknown }) => String(ei.caseId) === caseId,
      );

      if (existingIdx >= 0) {
        const nextQty = Math.max(
          0,
          updatedItems[existingIdx].quantity + qtyDelta,
        );
        if (nextQty === 0) {
          updatedItems.splice(existingIdx, 1);
        } else {
          updatedItems[existingIdx] = {
            ...updatedItems[existingIdx],
            quantity: nextQty,
          };
        }
      } else if (qtyDelta > 0) {
        updatedItems.push({
          caseId,
          marketHashName: caseItem?.marketHashName ?? "",
          quantity: qtyDelta,
          addedAt: new Date(),
        });
      }

      await suCollection.updateOne(
        { _id: new ObjectId(suId), ...ownerFilter },
        { $set: { items: updatedItems, updatedAt: new Date() } },
      );
    };

    if (oldSuId !== newSuId) {
      if (oldSuId) await adjustStorageUnitItem(oldSuId, -oldQty);
      if (newSuId) await adjustStorageUnitItem(newSuId, newQty);
    } else if (oldSuId && oldQty !== newQty) {
      await adjustStorageUnitItem(oldSuId, newQty - oldQty);
    }

    const updated = await portfolioService.update(id, input);

    if (!updated) {
      return NextResponse.json(
        { message: "itemNotFound" },
        { status: 404 },
      );
    }

    const report = await portfolioReportService.buildReport({
      refreshStalePrices: false,
    });
    return NextResponse.json(serializeReport(report));
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "cannotUpdatePortfolio") },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ownerId = await getPortfolioOwnerId();
    const { portfolioService, portfolioReportService } = createServices({
      ownerId,
    });
    const db = await getDatabase();

    const ownerFilter =
      ownerId === "guest"
        ? { $or: [{ ownerId: "guest" }, { ownerId: { $exists: false } }] }
        : { ownerId };

    const oldItem = await db
      .collection("portfolio_items")
      .findOne({ _id: new ObjectId(id), ...ownerFilter });

    if (oldItem && oldItem.storageUnitId) {
      const oldSuId = String(oldItem.storageUnitId);
      const oldQty = Number(oldItem.quantity ?? 0);
      const caseId = String(oldItem.caseId);

      const suCollection = db.collection("storage_units");
      const suDoc = await suCollection.findOne({
        _id: new ObjectId(oldSuId),
        ...ownerFilter,
      });
      if (suDoc) {
        const existingItems = Array.isArray(suDoc.items) ? suDoc.items : [];
        const updatedItems = [...existingItems];
        const existingIdx = updatedItems.findIndex(
          (ei: { caseId: unknown }) => String(ei.caseId) === caseId,
        );

        if (existingIdx >= 0) {
          const nextQty = Math.max(
            0,
            updatedItems[existingIdx].quantity - oldQty,
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
            { _id: new ObjectId(oldSuId), ...ownerFilter },
            { $set: { items: updatedItems, updatedAt: new Date() } },
          );
        }
      }
    }

    const deleted = await portfolioService.delete(id);

    if (!deleted) {
      return NextResponse.json(
        { message: "itemNotFound" },
        { status: 404 },
      );
    }

    const report = await portfolioReportService.buildReport({
      refreshStalePrices: false,
    });
    return NextResponse.json(serializeReport(report));
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "cannotUpdatePortfolio") },
      { status: 400 },
    );
  }
}
