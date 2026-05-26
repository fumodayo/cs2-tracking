import { ObjectId, type Document, type WithId } from "mongodb";
import type { CaseItem } from "@/domain/case-item";
import type { PortfolioItem } from "@/domain/portfolio-item";
import type { PriceSnapshot } from "@/domain/price";

export function toObjectId(id: string): ObjectId {
  if (!ObjectId.isValid(id)) {
    throw new Error(`Invalid ObjectId: ${id}`);
  }

  return new ObjectId(id);
}

export function mapCaseDocument(doc: WithId<Document>): CaseItem {
  return {
    id: doc._id.toString(),
    name: String(doc.name),
    marketHashName: String(doc.marketHashName),
    imageUrl: doc.imageUrl ? String(doc.imageUrl) : undefined,
    isActive: Boolean(doc.isActive),
  };
}

export function mapPortfolioDocument(doc: WithId<Document>): PortfolioItem {
  return {
    id: doc._id.toString(),
    caseId: String(doc.caseId),
    quantity: Number(doc.quantity),
    buyPrice: Number(doc.buyPrice),
    buyCurrency: "VND",
    buyDate: new Date(doc.buyDate),
    note: doc.note ? String(doc.note) : undefined,
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt),
  };
}

export function mapPriceDocument(doc: WithId<Document>): PriceSnapshot {
  return {
    id: doc._id.toString(),
    caseId: String(doc.caseId),
    price: Number(doc.price),
    currency: "VND",
    source: String(doc.source),
    capturedAt: new Date(doc.capturedAt),
  };
}
