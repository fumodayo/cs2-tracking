import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { getPortfolioOwnerId, getCurrentUser, isAdminAccessAllowed } from "@/services/auth-service";
import { decrypt } from "@/services/crypto-service";
import { createServices } from "@/infrastructure/container";
import { ObjectId } from "mongodb";
import { getOwnerFilter } from "@/infrastructure/db/owner-filter";
import {
  SCANNER_IMPORT_NOTE,
  SCANNER_IMPORT_NOTES,
  mergeSourceAccounts,
  getImportableScanPrice,
  buildAccessoryPriceFields,
  resolveSyncTransactions,
  processScanResult,
  pollJobProgress,
  startInventoryScanJob,
  buildSyncGroupKey,
  createImportedCase,
  updateImportedCaseMetadata,
  type ExistingPortfolioItem,
  type SyncScannedItem,
  type GroupedInput,
  type SyncProgressEvent,
  type AccountChangeDetail,
  type MissingItem,
  type ExtraItem,
  type SyncStorageUnit,
} from "@/services/portfolio-sync";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ownerId = await getPortfolioOwnerId();
  const db = await getDatabase();

  const { searchParams } = new URL(request.url);
  const user = await getCurrentUser();
  const isAdmin = isAdminAccessAllowed(user);
  const bypassCooldown = isAdmin && searchParams.get("bypassCooldown") === "true";

  const accounts = (await db
    .collection("portfolio_accounts")
    .find(getOwnerFilter(ownerId))
    .toArray()) as Array<{
      _id: ObjectId;
      name?: string;
      steamId64: string;
      avatarUrl?: string;
      lastSyncedAt?: string | Date;
      steamCookie?: string;
      steamUrl: string;
    }>;

  if (accounts.length === 0) {
    return NextResponse.json(
      { message: "noLinkedSteamAccounts" },
      { status: 400 },
    );
  }

  const origin = request.nextUrl.origin;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;
      const send = (event: SyncProgressEvent) => {
        if (isClosed) return;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };
      const close = () => {
        if (isClosed) return;
        isClosed = true;
        controller.close();
      };

      try {
        const allScannedItems: SyncScannedItem[] = [];
        const skippedAccounts: string[] = [];
        const allScannedStorageUnits: Array<{
          steamId64: string;
          assetId: string;
          name: string;
          iconUrl: string | null;
        }> = [];

        // Scan each account with job-based progress polling
        for (let i = 0; i < accounts.length; i++) {
          const account = accounts[i];
          const accountName = String(account.name || `TK ${i + 1}`);
          const accountPercent = (percent: number) =>
            Math.round(
              (i / accounts.length) * 80 +
                (percent / 100) * (80 / accounts.length),
            );

          send({
            type: "account_start",
            accountIndex: i,
            totalAccounts: accounts.length,
            accountName,
            steamId64: String(account.steamId64),
            avatarUrl: account.avatarUrl ?? null,
            message: `syncStartingScan:name=${accountName}`,
            percent: accountPercent(0),
          });

          try {
            const lastSyncedAt = account.lastSyncedAt;
            const cooldownMs = 5 * 60 * 1000;
            const inCooldown = !bypassCooldown && lastSyncedAt && (Date.now() - new Date(lastSyncedAt).getTime() < cooldownMs);
            const forceRefresh = !inCooldown;

            const rawCookie = account.steamCookie
              ? decrypt(account.steamCookie)
              : undefined;
            const jobId = await startInventoryScanJob({
              steamUrl: account.steamUrl,
              steamCookie: rawCookie?.trim() || undefined,
              forceRefresh,
              ownerId,
            });

            // Poll job progress
            const scanResult = await pollJobProgress(
              origin,
              jobId,
              (progress) => {
                send({
                  type: "account_progress",
                  accountIndex: i,
                  totalAccounts: accounts.length,
                  accountName,
                  steamId64: String(account.steamId64),
                  avatarUrl: account.avatarUrl ?? null,
                  message: progress.message,
                  percent: accountPercent(progress.percent),
                  scanProgress: progress,
                });
              },
            );

            if (forceRefresh) {
              await db.collection("portfolio_accounts").updateOne(
                { _id: account._id, ...getOwnerFilter(ownerId) },
                { $set: { lastSyncedAt: new Date() } }
              );
            }

            // Process live results
            processScanResult(
              scanResult,
              account,
              allScannedItems,
              allScannedStorageUnits
            );

            send({
              type: "account_done",
              accountIndex: i,
              totalAccounts: accounts.length,
              accountName,
              steamId64: String(account.steamId64),
              avatarUrl: account.avatarUrl ?? null,
              message: `syncDoneScan:name=${accountName},count=${Array.isArray(scanResult.items) ? scanResult.items.length : 0}`,
              percent: accountPercent(100),
            });
          } catch (scanError) {
            console.error(`Error scanning account ${accountName}:`, scanError);
            skippedAccounts.push(accountName);

            send({
              type: "account_error",
              accountIndex: i,
              totalAccounts: accounts.length,
              accountName,
              steamId64: String(account.steamId64),
              avatarUrl: account.avatarUrl ?? null,
              message: `syncErrorScan:name=${accountName},error=${scanError instanceof Error ? scanError.message : "Unknown error"}`,
              percent: accountPercent(100),
            });
          }

          // Small delay between account scans
          if (i < accounts.length - 1) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }

        // Import phase
        if (skippedAccounts.length > 0) {
          send({
            type: "error",
            message: "syncFailedSkippedAccountsPreserved",
            percent: 100,
          });
          close();
          return;
        }

        send({
          type: "import_start",
          message: `syncImportingItems:count=${allScannedItems.length}`,
          percent: 82,
        });

        if (allScannedItems.length === 0) {
          send({
            type: "error",
            message: "syncFailedNoInventoryLoaded",
            percent: 100,
          });
          close();
          return;
        }

        // Read existing portfolio for missing items comparison (before clearing)
        const portfolioCol = db.collection("portfolio_items");
        const existingPortfolioItems = (await portfolioCol
          .find({
            ...getOwnerFilter(ownerId),
            note: { $in: [...SCANNER_IMPORT_NOTES] },
          })
          .toArray()) as unknown as ExistingPortfolioItem[];

        // Clear existing automated scan items
        await portfolioCol.deleteMany({
          ...getOwnerFilter(ownerId),
          note: { $in: [...SCANNER_IMPORT_NOTES] },
        });

        // Group and resolve items
        const { caseRepository, portfolioService, priceService } = createServices({
          ownerId,
        });
        const groupedInputs = new Map<string, GroupedInput>();
        const skippedItems: string[] = [];

        type ResolvedCaseCacheItem = {
          id: string;
          name: string;
          marketHashName: string;
          imageUrl: string | null;
          rarity?: SyncScannedItem["rarity"];
        };

        // Pre-fetch all cases to optimize N+1 lookups
        const allCasesDocs = await db
          .collection("cases")
          .find({ isActive: true })
          .toArray();
        const casesMap = new Map<string, ResolvedCaseCacheItem>();
        const casesByIdMap = new Map<string, ResolvedCaseCacheItem>();
        for (const doc of allCasesDocs) {
          const mapped: ResolvedCaseCacheItem = {
            id: doc._id.toString(),
            name: doc.name,
            marketHashName: doc.marketHashName,
            imageUrl: doc.imageUrl || null,
            rarity: doc.rarity,
          };
          casesMap.set(mapped.marketHashName, mapped);
          casesByIdMap.set(mapped.id, mapped);
        }

        for (const item of allScannedItems) {
          const marketHashName = item.caseItem.marketHashName;
          const rawCaseId = item.caseItem.id;
          const caseName = item.caseItem.name || marketHashName;
          const imageUrl = item.caseItem.imageUrl;
          const rarity = item.rarity;
          const quantity = Number(item.quantity);
          const price = getImportableScanPrice(item.price);
          const sourceAccounts = item.sourceAccounts || [];

          if (
            !Number.isFinite(quantity) ||
            quantity <= 0
          ) {
            skippedItems.push(marketHashName || "unknown");
            continue;
          }

          // Try resolving from cache first
          let resolvedCaseItem =
            (marketHashName ? casesMap.get(marketHashName) : null) ??
            (rawCaseId ? casesByIdMap.get(rawCaseId) : null);

          // If not found in cache, query database/repository (fallback)
          if (!resolvedCaseItem) {
            const fallbackItem =
              (marketHashName
                ? await caseRepository.findByMarketHashName(marketHashName)
                : null) ??
              (rawCaseId && ObjectId.isValid(rawCaseId)
                ? await caseRepository.findById(rawCaseId)
                : null) ??
              (marketHashName
                ? await createImportedCase(db, {
                    name: caseName || marketHashName,
                    marketHashName,
                    imageUrl: imageUrl ?? undefined,
                    rarity,
                  })
                : null);

            if (fallbackItem) {
              resolvedCaseItem = {
                id: fallbackItem.id,
                name: fallbackItem.name,
                marketHashName: fallbackItem.marketHashName,
                imageUrl: fallbackItem.imageUrl || null,
                rarity:
                  "rarity" in fallbackItem
                    ? (fallbackItem.rarity as SyncScannedItem["rarity"])
                    : undefined,
              };
              casesMap.set(resolvedCaseItem.marketHashName, resolvedCaseItem);
              casesByIdMap.set(resolvedCaseItem.id, resolvedCaseItem);
            }
          }

          // Update metadata only if the image or rarity actually changed / is missing in the database
          if (resolvedCaseItem && marketHashName) {
            const hasNewImage =
              imageUrl &&
              (!resolvedCaseItem.imageUrl ||
                resolvedCaseItem.imageUrl !== imageUrl);
            const hasNewRarity =
              rarity &&
              (!resolvedCaseItem.rarity ||
                resolvedCaseItem.rarity.name !== rarity.name ||
                resolvedCaseItem.rarity.color !== rarity.color);

            if (hasNewImage || hasNewRarity) {
              await updateImportedCaseMetadata(db, {
                marketHashName,
                imageUrl: imageUrl ?? undefined,
                rarity,
              });

              // Update our local cache
              if (hasNewImage) resolvedCaseItem.imageUrl = imageUrl;
              if (hasNewRarity) resolvedCaseItem.rarity = rarity;
            }
          }

          if (!resolvedCaseItem) {
            skippedItems.push(marketHashName || "unknown");
            continue;
          }

          const stickerFields = await buildAccessoryPriceFields(
            item.patternInfo,
            priceService,
          );
          const priceWithSticker = Math.round(
            price + (stickerFields.stickerBuyPriceAdd ?? 0),
          );
          const groupKey = buildSyncGroupKey({
            caseId: resolvedCaseItem.id,
            dopplerPhase: item.dopplerPhase,
            inspectLink: item.inspectLink,
            patternInfo: item.patternInfo,
          });
          const existing = groupedInputs.get(groupKey);
          if (existing) {
            const nextQuantity = existing.quantity + quantity;
            let updatedTradeHoldUntil = existing.tradeHoldUntil;
            if (item.tradeHoldUntil) {
              if (!updatedTradeHoldUntil || new Date(item.tradeHoldUntil).getTime() > new Date(updatedTradeHoldUntil).getTime()) {
                updatedTradeHoldUntil = item.tradeHoldUntil;
              }
            }
            groupedInputs.set(groupKey, {
              ...existing,
              quantity: nextQuantity,
              buyPrice: Math.round(
                (existing.buyPrice * existing.quantity +
                  priceWithSticker * quantity) /
                  nextQuantity,
              ),
              sourceAccounts: mergeSourceAccounts(
                existing.sourceAccounts,
                sourceAccounts,
              ),
              holdDays: Math.max(existing.holdDays, item.holdDays ?? 0),
              tradeHoldUntil: updatedTradeHoldUntil,
              stickerPriceRate: existing.stickerPriceRate,
              stickerBuyPriceRate: existing.stickerBuyPriceRate,
              stickerBuyPriceAdd: existing.stickerBuyPriceAdd,
              stickerScanTotalPrice: existing.stickerScanTotalPrice,
              stickerScanPriceCapturedAt: existing.stickerScanPriceCapturedAt,
            });
          } else {
            groupedInputs.set(groupKey, {
              caseId: resolvedCaseItem.id,
              quantity,
              buyPrice: priceWithSticker,
              note: SCANNER_IMPORT_NOTE,
              sourceAccounts,
              holdDays: item.holdDays ?? 0,
              tradeHoldUntil: item.tradeHoldUntil,
              dopplerPhase: item.dopplerPhase,
              inspectLink: item.inspectLink,
              patternInfo: item.patternInfo,
              ...stickerFields,
            });
          }
        }

        // Insert new items
        const buyDate = new Date();
        if (groupedInputs.size > 0) {
          const resolvedInputs = Array.from(groupedInputs.values()).flatMap(
            (input) => {
              return resolveSyncTransactions(
                input.caseId,
                input.quantity,
                input.buyPrice,
                input.sourceAccounts,
                input.holdDays,
                existingPortfolioItems,
                buyDate,
                input.note || SCANNER_IMPORT_NOTE,
                input.tradeHoldUntil ? new Date(input.tradeHoldUntil) : undefined,
                input.dopplerPhase,
                input.inspectLink,
                input.patternInfo,
                {
                  stickerPriceRate: input.stickerPriceRate,
                  stickerBuyPriceRate: input.stickerBuyPriceRate,
                  stickerScanTotalPrice: input.stickerScanTotalPrice,
                  stickerScanPriceCapturedAt: input.stickerScanPriceCapturedAt,
                },
              );
            },
          );

          if (resolvedInputs.length > 0) {
            await portfolioService.createMany(resolvedInputs);
          }
        }

        send({
          type: "import_done",
          message: `syncImportedGroupedItems:count=${groupedInputs.size}`,
          percent: 90,
        });

        // Upsert Storage Units from scan results
        let syncedStorageUnits: SyncStorageUnit[] = [];
        if (allScannedStorageUnits.length > 0) {
          const suCol = db.collection("storage_units");
          const now = new Date();
          for (const su of allScannedStorageUnits) {
            if (!su.assetId) continue;
            await suCol.updateOne(
              { ownerId, steamId64: su.steamId64, assetId: su.assetId },
              {
                $set: {
                  ownerId,
                  steamId64: su.steamId64,
                  assetId: su.assetId,
                  name: su.name,
                  iconUrl: su.iconUrl,
                  updatedAt: now,
                },
                $setOnInsert: {
                  items: [],
                  createdAt: now,
                },
              },
              { upsert: true },
            );
          }

          // Fetch all storage units for this owner to include in result
          const allSUs = await suCol.find(getOwnerFilter(ownerId)).toArray();
          syncedStorageUnits = allSUs.map((doc) => ({
            id: doc._id.toString(),
            name: String(doc.name),
            steamId64: String(doc.steamId64),
            currentCount: Array.isArray(doc.items)
              ? doc.items.reduce(
                  (sum: number, item: Record<string, unknown>) =>
                    sum + (Number(item.quantity) || 0),
                  0,
                )
              : 0,
          }));
        }

        // Detect missing and extra items (changes in quantity)
        const missingItems: MissingItem[] = [];
        const extraItems: ExtraItem[] = [];

        const getAccountChanges = (groupKey: string) => {
          const prevMap = new Map<string, { steamId64: string; name: string; quantity: number }>();
          const newMap = new Map<string, { steamId64: string; name: string; quantity: number }>();

          const prevItems = existingPortfolioItems.filter(item => {
            const k = buildSyncGroupKey({
              caseId: String(item.caseId),
              dopplerPhase: item.dopplerPhase,
              inspectLink: item.inspectLink,
              patternInfo: item.patternInfo,
            });
            return k === groupKey;
          });
          for (const item of prevItems) {
            if (item.sourceAccounts) {
              for (const sa of item.sourceAccounts) {
                const qty = sa.breakdown
                  ? (sa.breakdown.tradeable ?? 0) +
                    (sa.breakdown.onMarket ?? 0) +
                    (sa.breakdown.tradeProtected ?? 0) +
                    (sa.breakdown.hold ?? 0)
                  : 0;
                const existing = prevMap.get(sa.steamId64);
                if (existing) {
                  existing.quantity += qty;
                } else {
                  prevMap.set(sa.steamId64, { steamId64: sa.steamId64, name: sa.name, quantity: qty });
                }
              }
            }
          }

          const input = groupedInputs.get(groupKey);
          if (input?.sourceAccounts) {
            for (const sa of input.sourceAccounts) {
              const qty = sa.breakdown
                ? (sa.breakdown.tradeable ?? 0) +
                  (sa.breakdown.onMarket ?? 0) +
                  (sa.breakdown.tradeProtected ?? 0) +
                  (sa.breakdown.hold ?? 0)
                : 0;
              const existing = newMap.get(sa.steamId64);
              if (existing) {
                existing.quantity += qty;
              } else {
                newMap.set(sa.steamId64, { steamId64: sa.steamId64, name: sa.name, quantity: qty });
              }
            }
          }

          const changes: AccountChangeDetail[] = [];

          for (const [steamId64, prev] of prevMap) {
            const current = newMap.get(steamId64);
            const currentQty = current?.quantity ?? 0;
            const diff = currentQty - prev.quantity;
            if (diff !== 0) {
              changes.push({
                steamId64,
                name: prev.name,
                change: diff,
                previousQuantity: prev.quantity,
                currentQuantity: currentQty
              });
            }
          }

          for (const [steamId64, current] of newMap) {
            if (!prevMap.has(steamId64)) {
              changes.push({
                steamId64,
                name: current.name,
                change: current.quantity,
                previousQuantity: 0,
                currentQuantity: current.quantity
              });
            }
          }

          return changes;
        };

        // Build a map of groupKey -> previous quantity from existing portfolio
        const previousQuantities = new Map<
          string,
          { quantity: number; groupKey: string }
        >();
        for (const doc of existingPortfolioItems) {
          const caseId = String(doc.caseId);
          const groupKey = buildSyncGroupKey({
            caseId,
            dopplerPhase: doc.dopplerPhase,
            inspectLink: doc.inspectLink,
            patternInfo: doc.patternInfo,
          });

          const existing = previousQuantities.get(groupKey);
          previousQuantities.set(groupKey, {
            groupKey,
            quantity: (existing?.quantity ?? 0) + Number(doc.quantity),
          });
        }

        // 1. Compare items that were in previous portfolio
        for (const [groupKey, prev] of previousQuantities) {
          const newQuantity = groupedInputs.get(groupKey)?.quantity ?? 0;
          const [caseId] = groupKey.split(":");

          if (newQuantity < prev.quantity) {
            const caseDoc = await caseRepository.findById(caseId);
            missingItems.push({
              caseId,
              marketHashName: caseDoc?.marketHashName ?? "unknown",
              caseName: caseDoc?.name ?? "Unknown Item",
              imageUrl: caseDoc?.imageUrl ?? null,
              previousQuantity: prev.quantity,
              currentQuantity: newQuantity,
              missingQuantity: prev.quantity - newQuantity,
              accounts: getAccountChanges(groupKey),
            });
          } else if (newQuantity > prev.quantity) {
            const caseDoc = await caseRepository.findById(caseId);
            const input = groupedInputs.get(groupKey);
            const breakdown = {
              tradeable: 0,
              onMarket: 0,
              tradeProtected: 0,
              hold: 0,
            };
            if (input?.sourceAccounts) {
              for (const sa of input.sourceAccounts) {
                if (sa.breakdown) {
                  breakdown.tradeable += sa.breakdown.tradeable ?? 0;
                  breakdown.onMarket += sa.breakdown.onMarket ?? 0;
                  breakdown.tradeProtected += sa.breakdown.tradeProtected ?? 0;
                  breakdown.hold += sa.breakdown.hold ?? 0;
                }
              }
            }
            extraItems.push({
              caseId,
              marketHashName: caseDoc?.marketHashName ?? "unknown",
              caseName: caseDoc?.name ?? "Unknown Item",
              imageUrl: caseDoc?.imageUrl ?? null,
              previousQuantity: prev.quantity,
              currentQuantity: newQuantity,
              extraQuantity: newQuantity - prev.quantity,
              accounts: getAccountChanges(groupKey),
              breakdown,
            });
          }
        }

        // 2. Identify brand new items (not in previous portfolio at all)
        for (const [groupKey, input] of groupedInputs) {
          if (!previousQuantities.has(groupKey)) {
            const [caseId] = groupKey.split(":");
            const caseDoc = await caseRepository.findById(caseId);
            const breakdown = {
              tradeable: 0,
              onMarket: 0,
              tradeProtected: 0,
              hold: 0,
            };
            if (input?.sourceAccounts) {
              for (const sa of input.sourceAccounts) {
                if (sa.breakdown) {
                  breakdown.tradeable += sa.breakdown.tradeable ?? 0;
                  breakdown.onMarket += sa.breakdown.onMarket ?? 0;
                  breakdown.tradeProtected += sa.breakdown.tradeProtected ?? 0;
                  breakdown.hold += sa.breakdown.hold ?? 0;
                }
              }
            }
            extraItems.push({
              caseId,
              marketHashName: caseDoc?.marketHashName ?? "unknown",
              caseName: caseDoc?.name ?? "Unknown Item",
              imageUrl: caseDoc?.imageUrl ?? null,
              previousQuantity: 0,
              currentQuantity: input.quantity,
              extraQuantity: input.quantity,
              accounts: getAccountChanges(groupKey),
              breakdown,
            });
          }
        }

        const summary = {
          scannedAccountsCount: accounts.length - skippedAccounts.length,
          totalAccountsCount: accounts.length,
          importedCount: groupedInputs.size,
          skippedAccounts,
          missingItems: missingItems.length > 0 ? missingItems : undefined,
          extraItems: extraItems.length > 0 ? extraItems : undefined,
          storageUnits:
            syncedStorageUnits.length > 0 ? syncedStorageUnits : undefined,
        };

        send({
          type: "complete",
          message: `syncComplete:scanned=${summary.scannedAccountsCount},total=${summary.totalAccountsCount},imported=${summary.importedCount},missingCount=${missingItems.length},extraCount=${extraItems.length}`,
          percent: 100,
          summary,
        });
      } catch (error) {
        send({
          type: "error",
          message: error instanceof Error ? error.message : "syncFailed",
          percent: 100,
        });
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
