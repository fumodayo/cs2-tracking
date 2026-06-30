import { ObjectId, type Document, type WithId } from 'mongodb';
import type { CaseItem } from '@/domain/case-item';
import type { PortfolioItem } from '@/domain/portfolio-item';
import type { PriceSnapshot } from '@/domain/price';

export function toObjectId(id: string): ObjectId {
  if (!ObjectId.isValid(id)) {
    throw new Error(`Invalid ObjectId: ${id}`);
  }

  return new ObjectId(id);
}

export function mapCaseDocument(doc: WithId<Document>): CaseItem {
  const rarity = isCaseRarity(doc.rarity)
    ? {
        name: String(doc.rarity.name),
        color: String(doc.rarity.color),
      }
    : undefined;

  return {
    id: doc._id.toString(),
    name: String(doc.name),
    marketHashName: String(doc.marketHashName),
    imageUrl: doc.imageUrl ? String(doc.imageUrl) : undefined,
    rarity,
    isActive: Boolean(doc.isActive),
  };
}

function isCaseRarity(value: unknown): value is { name: unknown; color: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'color' in value &&
    typeof value.name === 'string' &&
    typeof value.color === 'string' &&
    /^#[0-9a-f]{6}$/i.test(value.color)
  );
}

export function mapPortfolioDocument(doc: WithId<Document>): PortfolioItem {
  return {
    id: doc._id.toString(),
    caseId: String(doc.caseId),
    quantity: Number(doc.quantity),
    buyPrice: Number(doc.buyPrice),
    buyCurrency: 'VND',
    buyDate: new Date(doc.buyDate),
    note: doc.note ? String(doc.note) : undefined,
    sourceAccounts: Array.isArray(doc.sourceAccounts)
      ? doc.sourceAccounts
          .map((account) => ({
            steamId64: String(account?.steamId64 ?? ''),
            name: String(account?.name ?? ''),
            breakdown: account?.breakdown
              ? {
                  tradeable: Number(account.breakdown.tradeable ?? 0),
                  onMarket: Number(account.breakdown.onMarket ?? 0),
                  tradeProtected: Number(account.breakdown.tradeProtected ?? 0),
                  hold: Number(account.breakdown.hold ?? 0),
                  holdDetails: Array.isArray(account.breakdown.holdDetails)
                    ? account.breakdown.holdDetails.map(
                        (hd: { quantity?: unknown; holdDays?: unknown }) => ({
                          quantity: Number(hd?.quantity ?? 0),
                          holdDays: Number(hd?.holdDays ?? 0),
                        })
                      )
                    : undefined,
                }
              : undefined,
          }))
          .filter((account) => account.steamId64 && account.name)
      : [],
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt),
    tradeHoldUntil: doc.tradeHoldUntil ? new Date(doc.tradeHoldUntil) : undefined,
    isTemporaryPrice: doc.isTemporaryPrice ? Boolean(doc.isTemporaryPrice) : undefined,
    storageUnitId: doc.storageUnitId ? String(doc.storageUnitId) : undefined,
    dopplerPhase: doc.dopplerPhase ? String(doc.dopplerPhase) : undefined,
    inspectLink: doc.inspectLink ? String(doc.inspectLink) : undefined,
    patternInfo: doc.patternInfo ? (doc.patternInfo as any) : undefined,
    stickerPriceRate: doc.stickerPriceRate !== undefined ? Number(doc.stickerPriceRate) : undefined,
    stickerBuyPriceRate:
      doc.stickerBuyPriceRate !== undefined ? Number(doc.stickerBuyPriceRate) : undefined,
    stickerBuyPriceAdd:
      doc.stickerBuyPriceAdd !== undefined ? Number(doc.stickerBuyPriceAdd) : undefined,
    stickerScanTotalPrice:
      doc.stickerScanTotalPrice !== undefined ? Number(doc.stickerScanTotalPrice) : undefined,
    stickerScanPriceCapturedAt: doc.stickerScanPriceCapturedAt
      ? new Date(doc.stickerScanPriceCapturedAt)
      : undefined,
  };
}

export function mapPriceDocument(doc: WithId<Document>): PriceSnapshot {
  return {
    id: doc._id.toString(),
    caseId: String(doc.caseId),
    price: Number(doc.price),
    currency: 'VND',
    source: String(doc.source),
    capturedAt: new Date(doc.capturedAt),
  };
}
