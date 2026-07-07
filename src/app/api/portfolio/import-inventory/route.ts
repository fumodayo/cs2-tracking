import { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getErrorMessage } from '@/utils/error';
import type { CaseItem } from '@/domain/case-item';
import type { PatternInfo } from '@/domain/pattern-info';
import type { PortfolioSourceAccount, CreatePortfolioItemInput } from '@/domain/portfolio-item';
import {
  SCANNER_IMPORT_NOTE,
  SCANNER_MANUAL_NOTE,
  SCANNER_PORTFOLIO_NOTES,
  buildSyncGroupKey,
  buildAccessoryPriceFields,
  createImportedCase,
  getImportableScanPrice,
  mergeSourceAccounts,
  normalizeRarity,
  resolveSyncTransactions,
  updateImportedCaseMetadata,
  type ExistingPortfolioItem,
} from '@/services/portfolio-sync';
import { createServices } from '@/infrastructure/container';
import { calculateTradeHoldUntil } from '@/utils/date';
import { getDatabase } from '@/infrastructure/db/mongo-client';
import { mapCaseDocument } from '@/infrastructure/db/mappers';
import { getCurrentUser, getPortfolioOwnerId } from '@/services/auth-service';
import { encrypt, decrypt } from '@/services/crypto-service';
import { mergeIncomingCookieWithExisting } from '@/utils/steam-cookies';
import { getCachedScan } from '@/services/scan-cache';

export const dynamic = 'force-dynamic';

type InventoryImportItem = {
  caseItem?: {
    id?: unknown;
    name?: unknown;
    marketHashName?: unknown;
    imageUrl?: unknown;
    rarity?: unknown;
  };
  rarity?: unknown;
  quantity?: unknown;
  price?: unknown;
  isManual?: unknown;
  sourceAccounts?: unknown;
  holdDays?: unknown;
  buyPrice?: unknown;
  buyDate?: unknown;
  tradeHoldUntil?: unknown;
  storageUnitId?: unknown;
  buffPriceManual?: unknown;
  buffRateManual?: unknown;
  dopplerPhase?: unknown;
  inspectLink?: unknown;
  patternInfo?: unknown;
  stickerPriceRate?: unknown;
  stickerBuyPriceRate?: unknown;
  stickerScanTotalPrice?: unknown;
  stickerScanPriceCapturedAt?: unknown;
};

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendProgress(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
      }

      try {
        const user = await getCurrentUser();
        if (!user) {
          sendProgress({
            type: 'error',
            message: 'importErrorLoginRequired',
          });
          controller.close();
          return;
        }

        const body = await request.json();
        const items = normalizeItems(body.items);
        const { caseRepository, portfolioService, priceService } = createServices({
          ownerId: await getPortfolioOwnerId(),
        });

        const now = new Date();
        const manualInputs: CreatePortfolioItemInput[] = [];
        const scannedInputs = new Map<
          string,
          {
            caseId: string;
            quantity: number;
            buyPrice: number;
            note: string;
            sourceAccounts: PortfolioSourceAccount[];
            holdDays: number;
            tradeHoldUntil?: string;
            dopplerPhase?: string;
            inspectLink?: string;
            patternInfo?: PatternInfo;
            stickerPriceRate?: number;
            stickerBuyPriceRate?: number;
            stickerScanTotalPrice?: number;
            stickerScanPriceCapturedAt?: Date;
          }
        >();
        const storageUnitAssignments: Array<{
          storageUnitId: string;
          caseId: string;
          marketHashName: string;
          quantity: number;
        }> = [];

        const skipped: string[] = [];
        const totalItems = items.length;

        // Pre-fetch all cases to optimize N+1 lookups
        const db = await getDatabase();
        const allCasesDocs = await db.collection('cases').find({ isActive: true }).toArray();
        const casesMap = new Map<string, CaseItem>();
        const casesByIdMap = new Map<string, CaseItem>();
        for (const doc of allCasesDocs) {
          const mapped = mapCaseDocument(doc);
          casesMap.set(mapped.marketHashName, mapped);
          casesByIdMap.set(String(mapped.id), mapped);
        }

        sendProgress({
          type: 'progress',
          message: `importProgressProcessingItems:total=${totalItems}`,
          percent: 0,
          step: 'resolve',
        });

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const marketHashName = getOptionalString(item.caseItem?.marketHashName);
          const rawCaseId = getOptionalString(item.caseItem?.id);
          const caseName = getOptionalString(item.caseItem?.name) ?? marketHashName;
          const imageUrl = getOptionalString(item.caseItem?.imageUrl);
          const rarity = normalizeRarity(item.rarity) ?? normalizeRarity(item.caseItem?.rarity);
          const quantity = Number(item.quantity);
          const price = getImportableScanPrice(item.price);
          const isManual = item.isManual === true;
          const sourceAccounts = normalizeSourceAccounts(item.sourceAccounts);
          const holdDays =
            typeof item.holdDays === 'number' && item.holdDays > 0 ? item.holdDays : 0;
          const dopplerPhase = getOptionalString(item.dopplerPhase);
          const inspectLink = getOptionalString(item.inspectLink);
          const patternInfo = normalizePatternInfo(item.patternInfo);
          const accessoryFields = await buildAccessoryPriceFields(patternInfo, priceService, now);
          const stickerBuyPriceRate =
            getOptionalNumber(item.stickerBuyPriceRate) ?? accessoryFields.stickerBuyPriceRate;
          const stickerPriceRate =
            getOptionalNumber(item.stickerPriceRate) ?? accessoryFields.stickerPriceRate;
          const stickerScanTotalPrice =
            getOptionalNumber(item.stickerScanTotalPrice) ?? accessoryFields.stickerScanTotalPrice;
          const stickerScanPriceCapturedAt =
            getOptionalDate(item.stickerScanPriceCapturedAt) ??
            (stickerScanTotalPrice !== undefined
              ? (accessoryFields.stickerScanPriceCapturedAt ?? now)
              : undefined);
          const stickerBuyPriceAdd =
            stickerScanTotalPrice !== undefined && stickerBuyPriceRate !== undefined
              ? Math.round((stickerScanTotalPrice * stickerBuyPriceRate) / 100)
              : 0;

          if (!Number.isFinite(quantity) || quantity <= 0) {
            skipped.push(marketHashName ?? rawCaseId ?? 'unknown');
            continue;
          }

          // Try resolving from cache first
          let resolvedCaseItem =
            (marketHashName ? casesMap.get(marketHashName) : null) ??
            (rawCaseId ? casesByIdMap.get(rawCaseId) : null);

          // If not found in cache, query the repository (fallback) or create it
          if (!resolvedCaseItem) {
            resolvedCaseItem =
              (marketHashName ? await caseRepository.findByMarketHashName(marketHashName) : null) ??
              (rawCaseId && ObjectId.isValid(rawCaseId)
                ? await caseRepository.findById(rawCaseId)
                : null) ??
              (marketHashName
                ? await createImportedCase(db, {
                    name: caseName ?? marketHashName,
                    marketHashName,
                    imageUrl,
                    rarity,
                  })
                : null);

            // Add to cache to avoid future N+1 hits for this new case
            if (resolvedCaseItem) {
              casesMap.set(resolvedCaseItem.marketHashName, resolvedCaseItem);
              casesByIdMap.set(String(resolvedCaseItem.id), resolvedCaseItem);
            }
          }

          // Update metadata only if the image or rarity actually changed / is missing in the database
          if (resolvedCaseItem && marketHashName) {
            const hasNewImage =
              imageUrl && (!resolvedCaseItem.imageUrl || resolvedCaseItem.imageUrl !== imageUrl);
            const hasNewRarity =
              rarity &&
              (!resolvedCaseItem.rarity ||
                resolvedCaseItem.rarity.name !== rarity.name ||
                resolvedCaseItem.rarity.color !== rarity.color);

            if (hasNewImage || hasNewRarity) {
              await updateImportedCaseMetadata(db, {
                marketHashName,
                imageUrl,
                rarity,
              });

              // Update our local cache
              if (hasNewImage) resolvedCaseItem.imageUrl = imageUrl;
              if (hasNewRarity) resolvedCaseItem.rarity = rarity;
            }
          }

          if (!resolvedCaseItem) {
            skipped.push(marketHashName ?? rawCaseId ?? 'unknown');
            continue;
          }

          if (isManual) {
            const itemBuyPrice = typeof item.buyPrice === 'number' ? item.buyPrice : price;
            const buyDateStr = typeof item.buyDate === 'string' ? item.buyDate : null;
            const itemBuyDate = buyDateStr ? new Date(buyDateStr) : now;
            const storageUnitId = getOptionalString(item.storageUnitId);

            if (storageUnitId && ObjectId.isValid(storageUnitId)) {
              storageUnitAssignments.push({
                storageUnitId,
                caseId: resolvedCaseItem.id,
                marketHashName: resolvedCaseItem.marketHashName,
                quantity,
              });
            }

            manualInputs.push({
              caseId: resolvedCaseItem.id,
              quantity: quantity,
              buyPrice: itemBuyPrice,
              buyDate: itemBuyDate,
              sourceAccounts,
              note: SCANNER_MANUAL_NOTE,
              tradeHoldUntil:
                holdDays > 0 ? calculateTradeHoldUntil(itemBuyDate, holdDays) : undefined,
              storageUnitId: storageUnitId || undefined,
              dopplerPhase,
              inspectLink,
              patternInfo,
              stickerPriceRate,
              stickerBuyPriceRate,
              stickerScanTotalPrice,
              stickerScanPriceCapturedAt,
            });
          } else {
            const tradeHoldUntilStr =
              typeof item.tradeHoldUntil === 'string' ? item.tradeHoldUntil : undefined;
            const scanKey = buildSyncGroupKey({
              caseId: resolvedCaseItem.id,
              dopplerPhase,
              inspectLink,
              patternInfo,
              sourceAccounts,
              holdDays,
              tradeHoldUntil: tradeHoldUntilStr,
            });
            const existing = scannedInputs.get(scanKey);
            const scannedUnitBuyPrice = Math.round(price + stickerBuyPriceAdd);
            if (existing) {
              const nextQuantity = existing.quantity + quantity;
              let updatedTradeHoldUntil = existing.tradeHoldUntil;
              if (tradeHoldUntilStr) {
                if (
                  !updatedTradeHoldUntil ||
                  new Date(tradeHoldUntilStr).getTime() > new Date(updatedTradeHoldUntil).getTime()
                ) {
                  updatedTradeHoldUntil = tradeHoldUntilStr;
                }
              }
              scannedInputs.set(scanKey, {
                ...existing,
                quantity: nextQuantity,
                buyPrice: Math.round(
                  (existing.buyPrice * existing.quantity + scannedUnitBuyPrice * quantity) /
                    nextQuantity
                ),
                sourceAccounts: mergeSourceAccounts(existing.sourceAccounts, sourceAccounts),
                holdDays: Math.max(existing.holdDays, holdDays),
                tradeHoldUntil: updatedTradeHoldUntil,
                stickerPriceRate: existing.stickerPriceRate,
                stickerBuyPriceRate: existing.stickerBuyPriceRate,
                stickerScanTotalPrice: existing.stickerScanTotalPrice,
                stickerScanPriceCapturedAt: existing.stickerScanPriceCapturedAt,
              });
            } else {
              scannedInputs.set(scanKey, {
                caseId: resolvedCaseItem.id,
                quantity,
                buyPrice: scannedUnitBuyPrice,
                note: SCANNER_IMPORT_NOTE,
                sourceAccounts,
                holdDays,
                tradeHoldUntil: tradeHoldUntilStr,
                dopplerPhase,
                inspectLink,
                patternInfo,
                stickerPriceRate,
                stickerBuyPriceRate,
                stickerScanTotalPrice,
                stickerScanPriceCapturedAt,
              });
            }
          }

          // Send progress every 3 items or on last item
          if ((i + 1) % 3 === 0 || i === items.length - 1) {
            const percent = Math.round(((i + 1) / totalItems) * 70);
            sendProgress({
              type: 'progress',
              message: `importProgressProcessingItem:current=${i + 1},total=${totalItems},name=${caseName ?? marketHashName ?? '...'}`,
              percent,
              step: 'resolve',
              detail: { processed: i + 1, total: totalItems },
            });
          }
        }

        if (scannedInputs.size === 0 && manualInputs.length === 0) {
          sendProgress({
            type: 'error',
            message: 'importErrorNoValidItems',
          });
          controller.close();
          return;
        }

        // Save to portfolio
        sendProgress({
          type: 'progress',
          message: `importProgressSavingItems:count=${scannedInputs.size + manualInputs.length}`,
          percent: 75,
          step: 'save',
        });

        // Clear existing automated scan items and manual scanner items
        let existingPortfolioItems: ExistingPortfolioItem[] = [];
        try {
          const db = await getDatabase();
          const portfolioCol = db.collection('portfolio_items');
          const ownerId = await getPortfolioOwnerId();
          const ownerFilter =
            ownerId === 'guest'
              ? { $or: [{ ownerId: 'guest' }, { ownerId: { $exists: false } }] }
              : { ownerId };

          existingPortfolioItems = (await portfolioCol
            .find({
              ...ownerFilter,
              note: {
                $in: [...SCANNER_PORTFOLIO_NOTES],
              },
            })
            .toArray()) as unknown as ExistingPortfolioItem[];

          await portfolioCol.deleteMany({
            ...ownerFilter,
            note: {
              $in: [...SCANNER_PORTFOLIO_NOTES],
            },
          });
        } catch (clearError) {
          console.error('Failed to clear previous portfolio scan items:', clearError);
        }

        const finalInputs: CreatePortfolioItemInput[] = [...manualInputs];

        if (scannedInputs.size > 0) {
          const resolvedScanned = Array.from(scannedInputs.values()).flatMap((input) => {
            return resolveSyncTransactions(
              input.caseId,
              input.quantity,
              input.buyPrice,
              input.sourceAccounts,
              input.holdDays,
              existingPortfolioItems,
              now,
              SCANNER_IMPORT_NOTE,
              input.tradeHoldUntil ? new Date(input.tradeHoldUntil) : undefined,
              input.dopplerPhase,
              input.inspectLink,
              input.patternInfo,
              {
                stickerPriceRate: input.stickerPriceRate,
                stickerBuyPriceRate: input.stickerBuyPriceRate,
                stickerScanTotalPrice: input.stickerScanTotalPrice,
                stickerScanPriceCapturedAt: input.stickerScanPriceCapturedAt,
              }
            );
          });
          finalInputs.push(...resolvedScanned);
        }

        if (finalInputs.length > 0) {
          await portfolioService.createMany(finalInputs);
        }

        // Assign manual items to storage units if specified
        if (storageUnitAssignments.length > 0) {
          try {
            const db = await getDatabase();
            const suCollection = db.collection('storage_units');
            const ownerId = await getPortfolioOwnerId();

            for (const assign of storageUnitAssignments) {
              const suDoc = await suCollection.findOne({
                _id: new ObjectId(assign.storageUnitId),
                ownerId,
              });
              if (suDoc) {
                const existingItems = Array.isArray(suDoc.items) ? suDoc.items : [];
                const updatedItems = [...existingItems];
                const existingIdx = updatedItems.findIndex(
                  (ei) => (ei as { caseId?: string }).caseId === assign.caseId
                );

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
            }
          } catch (suError) {
            console.error('Failed to assign manual items to storage units:', suError);
          }
        }

        sendProgress({
          type: 'progress',
          message: 'importProgressLinkingAccounts',
          percent: 85,
          step: 'accounts',
        });

        // Save portfolio accounts
        try {
          const ownerId = await getPortfolioOwnerId();
          const allUniqueAccounts = new Map<string, PortfolioSourceAccount>();
          for (const input of scannedInputs.values()) {
            for (const account of input.sourceAccounts) {
              allUniqueAccounts.set(account.steamId64, account);
            }
          }
          for (const input of manualInputs) {
            if (input.sourceAccounts) {
              for (const account of input.sourceAccounts) {
                allUniqueAccounts.set(account.steamId64, account);
              }
            }
          }

          if (allUniqueAccounts.size > 0) {
            const db = await getDatabase();
            const accountsCollection = db.collection('portfolio_accounts');
            const now = new Date();

            // Build a map of steamId64 to steamCookie from frontend payload
            const clientAccounts = Array.isArray(body.accounts) ? body.accounts : [];
            const cookieMap = new Map<string, string>();
            for (const a of clientAccounts) {
              if (a && typeof a.steamId64 === 'string' && typeof a.steamCookie === 'string') {
                const trimmed = a.steamCookie.trim();
                if (trimmed) cookieMap.set(a.steamId64, trimmed);
              }
            }

            let accIdx = 0;
            for (const account of allUniqueAccounts.values()) {
              const privateCacheDoc = await getCachedScan({
                steamId64: account.steamId64,
                ownerId,
                hasCookie: true,
              });
              const publicCacheDoc = await getCachedScan({
                steamId64: account.steamId64,
                hasCookie: false,
              });
              const cacheDoc = privateCacheDoc ?? publicCacheDoc;
              const avatarUrl = cacheDoc?.profile?.avatarUrl || null;
              const clientCookie = cookieMap.get(account.steamId64);

              const $setFields: Record<string, unknown> = {
                ownerId,
                steamId64: account.steamId64,
                name: account.name,
                avatarUrl,
                updatedAt: now,
              };

              if (clientCookie) {
                let finalCookie = clientCookie;
                const existingAcc = await accountsCollection.findOne({
                  ownerId,
                  steamId64: account.steamId64,
                });
                if (existingAcc?.steamCookie) {
                  const decryptedExisting = decrypt(existingAcc.steamCookie);
                  finalCookie = mergeIncomingCookieWithExisting(clientCookie, decryptedExisting);
                }
                $setFields.steamCookie = encrypt(finalCookie);
              }

              if (privateCacheDoc) {
                if (privateCacheDoc.walletBalance !== undefined) {
                  $setFields.walletBalance = privateCacheDoc.walletBalance;
                }
                if (privateCacheDoc.walletBalanceVnd !== undefined) {
                  $setFields.walletBalanceVnd = privateCacheDoc.walletBalanceVnd;
                }
                if (privateCacheDoc.cookieError !== undefined) {
                  $setFields.cookieError = privateCacheDoc.cookieError;
                }
              }

              await accountsCollection.updateOne(
                { ownerId, steamId64: account.steamId64 },
                {
                  $set: $setFields,
                  $setOnInsert: {
                    steamUrl: `https://steamcommunity.com/profiles/${account.steamId64}`,
                    createdAt: now,
                  },
                },
                { upsert: true }
              );
              accIdx++;
              sendProgress({
                type: 'progress',
                message: `importProgressLinkingAccount:current=${accIdx},total=${allUniqueAccounts.size},name=${account.name}`,
                percent: 85 + Math.round((accIdx / allUniqueAccounts.size) * 10),
                step: 'accounts',
              });
            }
          }
        } catch (saveAccountsError) {
          console.error('Failed to automatically save portfolio accounts:', saveAccountsError);
        }

        const totalSavedCount = scannedInputs.size + manualInputs.length;
        sendProgress({
          type: 'done',
          message: `importDoneSaveResult:count=${totalSavedCount},skipped=${skipped.length}`,
          percent: 100,
          importResult: {
            importedCount: totalSavedCount,
            skippedCount: skipped.length,
            skipped,
          },
        });
        controller.close();
      } catch (error) {
        sendProgress({ type: 'error', message: getErrorMessage(error, 'importErrorGeneric') });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  });
}

function normalizeItems(value: unknown): InventoryImportItem[] {
  if (!Array.isArray(value)) {
    throw new Error('importErrorInvalidPayload');
  }

  return value.filter(isRecord) as InventoryImportItem[];
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getOptionalNumber(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : undefined;
}

function normalizePatternInfo(value: unknown): PatternInfo | undefined {
  return isRecord(value) ? (value as PatternInfo) : undefined;
}

function getOptionalDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value as string | number | Date);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSourceAccounts(value: unknown): PortfolioSourceAccount[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((account) => {
      const breakdownVal = isRecord(account.breakdown) ? account.breakdown : undefined;
      const breakdown = breakdownVal
        ? {
            tradeable: typeof breakdownVal.tradeable === 'number' ? breakdownVal.tradeable : 0,
            onMarket: typeof breakdownVal.onMarket === 'number' ? breakdownVal.onMarket : 0,
            tradeProtected:
              typeof breakdownVal.tradeProtected === 'number' ? breakdownVal.tradeProtected : 0,
            hold: typeof breakdownVal.hold === 'number' ? breakdownVal.hold : 0,
            holdDetails: Array.isArray(breakdownVal.holdDetails)
              ? breakdownVal.holdDetails.filter(isRecord).map((hd) => ({
                  quantity: typeof hd.quantity === 'number' ? hd.quantity : 0,
                  holdDays: typeof hd.holdDays === 'number' ? hd.holdDays : 0,
                }))
              : undefined,
          }
        : undefined;

      return {
        steamId64: getOptionalString(account.steamId64) ?? '',
        name: getOptionalString(account.name) ?? '',
        breakdown,
      };
    })
    .filter((account) => account.steamId64 && account.name);
}
