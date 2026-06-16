import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { getPortfolioOwnerId } from "@/services/auth-service";
import { decrypt } from "@/services/crypto-service";
import { createServices } from "@/infrastructure/container";
import { ObjectId, Db } from "mongodb";
import {
  normalizeRarity,
  mergeSourceAccounts,
  resolveSyncTransactions,
  type ExistingPortfolioItem,
} from "@/services/portfolio-sync";

export const dynamic = "force-dynamic";

type PortfolioSourceAccount = {
  steamId64: string;
  name: string;
  breakdown?: {
    tradeable: number;
    onMarket: number;
    tradeProtected: number;
    hold: number;
    holdDetails?: Array<{
      quantity: number;
      holdDays: number;
      tradeHoldUntil?: string;
    }>;
  };
};

type SyncScannedItem = {
  caseItem: {
    id: string;
    name: string;
    marketHashName: string;
    imageUrl: string | null;
  };
  rarity?: {
    name: string;
    color: string;
  };
  quantity: number;
  price: number;
  sourceAccounts: PortfolioSourceAccount[];
  holdDays?: number;
  tradeHoldUntil?: string;
  onMarket?: boolean;
  tradeProtected?: boolean;
};

type ScanResult = {
  items?: Array<{
    quantity?: number | string;
    holdDays?: number;
    tradeHoldUntil?: string;
    onMarket?: boolean;
    tradeProtected?: boolean;
    price?: number | string;
    rarity?: unknown;
    caseItem?: {
      id?: string;
      name?: string;
      marketHashName?: string;
      imageUrl?: string | null;
    };
  }>;
  storageUnits?: Array<{
    assetId?: string;
    name?: string;
    iconUrl?: string | null;
  }>;
};

type PortfolioAccountDb = {
  _id: ObjectId;
  name?: string;
  steamId64: string | number;
  avatarUrl?: string | null;
  steamUrl?: string;
  steamCookie?: string;
  lastSyncedAt?: Date | string;
};

type GroupedInput = {
  caseId: string;
  quantity: number;
  buyPrice: number;
  note: string;
  sourceAccounts: PortfolioSourceAccount[];
  holdDays: number;
  tradeHoldUntil?: string;
};

type SyncProgressEvent = {
  type:
    | "account_start"
    | "account_progress"
    | "account_done"
    | "account_error"
    | "import_start"
    | "import_done"
    | "complete"
    | "error";
  accountIndex?: number;
  totalAccounts?: number;
  accountName?: string;
  steamId64?: string;
  avatarUrl?: string | null;
  message: string;
  percent: number;
  scanProgress?: {
    stage: string;
    message: string;
    percent: number;
    detail?: Record<string, number | string>;
  };
  summary?: {
    scannedAccountsCount: number;
    totalAccountsCount: number;
    importedCount: number;
    skippedAccounts: string[];
    missingItems?: MissingItem[];
    extraItems?: ExtraItem[];
    storageUnits?: SyncStorageUnit[];
  };
};

type AccountChangeDetail = {
  steamId64: string;
  name: string;
  change: number;
  previousQuantity: number;
  currentQuantity: number;
};

type MissingItem = {
  caseId: string;
  marketHashName: string;
  caseName: string;
  imageUrl: string | null;
  previousQuantity: number;
  currentQuantity: number;
  missingQuantity: number;
  accounts?: AccountChangeDetail[];
};

type ExtraItem = {
  caseId: string;
  marketHashName: string;
  caseName: string;
  imageUrl: string | null;
  previousQuantity: number;
  currentQuantity: number;
  extraQuantity: number;
  accounts?: AccountChangeDetail[];
};

type SyncStorageUnit = {
  id: string;
  name: string;
  steamId64: string;
  currentCount: number;
};

export async function POST(request: NextRequest) {
  try {
    const ownerId = await getPortfolioOwnerId();
    const db = await getDatabase();

    const body = await request.json().catch(() => ({}));
    const { accountId } = body;

    if (!accountId || !ObjectId.isValid(accountId)) {
      return NextResponse.json(
        { message: "ID tài khoản không hợp lệ." },
        { status: 400 },
      );
    }

    const targetAccount = (await db
      .collection("portfolio_accounts")
      .findOne({
        _id: new ObjectId(accountId),
        ...getOwnerFilter(ownerId),
      })) as unknown as PortfolioAccountDb | null;

    if (!targetAccount) {
      return NextResponse.json(
        { message: "Không tìm thấy tài khoản Steam để đồng bộ." },
        { status: 404 },
      );
    }

    const lastSyncedAt = targetAccount.lastSyncedAt;
    const cooldownMs = 5 * 60 * 1000;
    if (lastSyncedAt && Date.now() - new Date(lastSyncedAt).getTime() < cooldownMs) {
      const remainingMs = cooldownMs - (Date.now() - new Date(lastSyncedAt).getTime());
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      const min = Math.floor(remainingSeconds / 60);
      const sec = remainingSeconds % 60;
      const timeStr = min > 0 ? `${min} phút ${sec} giây` : `${sec} giây`;
      return NextResponse.json(
        { message: `Tài khoản vừa mới quét. Vui lòng đợi thêm ${timeStr}.` },
        { status: 429 }
      );
    }

    const allAccounts = (await db
      .collection("portfolio_accounts")
      .find(getOwnerFilter(ownerId))
      .toArray()) as unknown as PortfolioAccountDb[];

    const origin = request.nextUrl.origin;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: SyncProgressEvent) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
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

          const accountName = String(targetAccount.name || "Tài khoản Steam");
          const targetSteamId64 = String(targetAccount.steamId64);

          // 1. Scan target account live
          send({
            type: "account_start",
            accountIndex: 0,
            totalAccounts: 1,
            accountName,
            steamId64: targetSteamId64,
            avatarUrl: targetAccount.avatarUrl ?? null,
            message: `Bắt đầu quét hòm đồ: ${accountName}`,
            percent: 0,
          });

          let targetScanResult: ScanResult | null = null;
          try {
            const rawCookie = targetAccount.steamCookie
              ? decrypt(targetAccount.steamCookie)
              : undefined;
            const startRes = await fetch(`${origin}/api/inventory/scan`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Cookie:
                  request.headers.get("Cookie") ||
                  request.headers.get("cookie") ||
                  "",
              },
              body: JSON.stringify({
                steamUrl: targetAccount.steamUrl,
                steamCookie: rawCookie?.trim() || undefined,
                forceRefresh: true,
                progress: true,
              }),
            });

            if (!startRes.ok) {
              const errData = await startRes.json().catch(() => ({}));
              throw new Error(errData.message || `HTTP ${startRes.status}`);
            }

            const { jobId } = await startRes.json();

            // Poll progress
            targetScanResult = await pollJobProgress(
              origin,
              jobId,
              (progress) => {
                send({
                  type: "account_progress",
                  accountIndex: 0,
                  totalAccounts: 1,
                  accountName,
                  steamId64: targetSteamId64,
                  avatarUrl: targetAccount.avatarUrl ?? null,
                  message: progress.message,
                  percent: Math.round(progress.percent * 0.8), // 0% to 80%
                  scanProgress: progress,
                });
              },
            );

            // Process live results
            processScanResult(
              targetScanResult,
              targetAccount,
              allScannedItems,
              allScannedStorageUnits,
            );

            send({
              type: "account_done",
              accountIndex: 0,
              totalAccounts: 1,
              accountName,
              steamId64: targetSteamId64,
              avatarUrl: targetAccount.avatarUrl ?? null,
              message: `Hoàn tất quét: ${accountName} (${Array.isArray(targetScanResult?.items) ? targetScanResult.items.length : 0} item)`,
              percent: 80,
            });
          } catch (scanError) {
            console.error(`Error scanning account ${accountName}:`, scanError);
            skippedAccounts.push(accountName);

            send({
              type: "account_error",
              accountIndex: 0,
              totalAccounts: 1,
              accountName,
              steamId64: targetSteamId64,
              avatarUrl: targetAccount.avatarUrl ?? null,
              message: `Lỗi quét ${accountName}: ${scanError instanceof Error ? scanError.message : "Unknown error"}`,
              percent: 80,
            });
          }

          // 2. Load cached scan results for all other accounts
          send({
            type: "import_start",
            message: `Đang lấy dữ liệu cache các tài khoản khác...`,
            percent: 82,
          });

          for (const account of allAccounts) {
            const currentSteamId = String(account.steamId64);
            if (currentSteamId === targetSteamId64) continue;

            try {
              const cached = (await db
                .collection("inventory_scan_cache")
                .findOne({ steamId64: currentSteamId })) as unknown as ScanResult | null;

              if (cached) {
                processScanResult(
                  cached,
                  account,
                  allScannedItems,
                  allScannedStorageUnits,
                );
              }
            } catch (cacheError) {
              console.error(
                `Error loading cache for ${account.name}:`,
                cacheError,
              );
            }
          }

          // 3. Import phase
          send({
            type: "import_start",
            message: `Đang import ${allScannedItems.length} item vào portfolio...`,
            percent: 85,
          });

          if (allScannedItems.length === 0) {
            send({
              type: "error",
              message:
                "Đồng bộ thất bại. Không thể tải dữ liệu kho đồ từ bất kỳ tài khoản nào.",
              percent: 100,
            });
            controller.close();
            return;
          }

          // Read existing portfolio for missing items comparison (before clearing)
          const portfolioCol = db.collection("portfolio_items");
          const existingPortfolioItems = (await portfolioCol
            .find({
              ...getOwnerFilter(ownerId),
              note: "Import từ inventory scanner",
            })
            .toArray()) as unknown as ExistingPortfolioItem[];

          // Clear existing automated scan items
          await portfolioCol.deleteMany({
            ...getOwnerFilter(ownerId),
            note: "Import từ inventory scanner",
          });

          // Group and resolve items
          const { caseRepository, portfolioService } = createServices({
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
            const price = Number(item.price);
            const sourceAccounts = item.sourceAccounts || [];

            if (
              !Number.isFinite(quantity) ||
              quantity <= 0 ||
              !Number.isFinite(price) ||
              price <= 0
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

            const existing = groupedInputs.get(resolvedCaseItem.id);
            if (existing) {
              const nextQuantity = existing.quantity + quantity;
              let updatedTradeHoldUntil = existing.tradeHoldUntil;
              if (item.tradeHoldUntil) {
                if (!updatedTradeHoldUntil || new Date(item.tradeHoldUntil).getTime() > new Date(updatedTradeHoldUntil).getTime()) {
                  updatedTradeHoldUntil = item.tradeHoldUntil;
                }
              }
              groupedInputs.set(resolvedCaseItem.id, {
                ...existing,
                quantity: nextQuantity,
                buyPrice: Math.round(
                  (existing.buyPrice * existing.quantity + price * quantity) /
                    nextQuantity,
                ),
                sourceAccounts: mergeSourceAccounts(
                  existing.sourceAccounts,
                  sourceAccounts,
                ),
                holdDays: Math.max(existing.holdDays, item.holdDays ?? 0),
                tradeHoldUntil: updatedTradeHoldUntil,
              });
            } else {
              groupedInputs.set(resolvedCaseItem.id, {
                caseId: resolvedCaseItem.id,
                quantity,
                buyPrice: Math.round(price),
                note: "Import từ inventory scanner",
                sourceAccounts,
                holdDays: item.holdDays ?? 0,
                tradeHoldUntil: item.tradeHoldUntil,
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
                  input.note || "Import từ inventory scanner",
                  input.tradeHoldUntil ? new Date(input.tradeHoldUntil) : undefined,
                );
              },
            );

            if (resolvedInputs.length > 0) {
              await portfolioService.createMany(resolvedInputs);
            }
          }

          send({
            type: "import_done",
            message: `Đã import ${groupedInputs.size} loại item vào portfolio.`,
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

          const getAccountChanges = (caseId: string) => {
            const prevMap = new Map<string, { steamId64: string; name: string; quantity: number }>();
            const newMap = new Map<string, { steamId64: string; name: string; quantity: number }>();

            const prevItems = existingPortfolioItems.filter(item => String(item.caseId) === caseId);
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

            const input = groupedInputs.get(caseId);
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

          // Build a map of caseId -> previous quantity from existing portfolio
          const previousQuantities = new Map<
            string,
            { quantity: number; caseId: string }
          >();
          for (const doc of existingPortfolioItems) {
            const caseId = String(doc.caseId);
            const existing = previousQuantities.get(caseId);
            previousQuantities.set(caseId, {
              caseId,
              quantity: (existing?.quantity ?? 0) + Number(doc.quantity),
            });
          }

          // 1. Compare items that were in previous portfolio
          for (const [caseId, prev] of previousQuantities) {
            const newQuantity = groupedInputs.get(caseId)?.quantity ?? 0;
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
                accounts: getAccountChanges(caseId),
              });
            } else if (newQuantity > prev.quantity) {
              const caseDoc = await caseRepository.findById(caseId);
              extraItems.push({
                caseId,
                marketHashName: caseDoc?.marketHashName ?? "unknown",
                caseName: caseDoc?.name ?? "Unknown Item",
                imageUrl: caseDoc?.imageUrl ?? null,
                previousQuantity: prev.quantity,
                currentQuantity: newQuantity,
                extraQuantity: newQuantity - prev.quantity,
                accounts: getAccountChanges(caseId),
              });
            }
          }

          // 2. Identify brand new items (not in previous portfolio at all)
          for (const [caseId, input] of groupedInputs) {
            if (!previousQuantities.has(caseId)) {
              const caseDoc = await caseRepository.findById(caseId);
              extraItems.push({
                caseId,
                marketHashName: caseDoc?.marketHashName ?? "unknown",
                caseName: caseDoc?.name ?? "Unknown Item",
                imageUrl: caseDoc?.imageUrl ?? null,
                previousQuantity: 0,
                currentQuantity: input.quantity,
                extraQuantity: input.quantity,
                accounts: getAccountChanges(caseId),
              });
            }
          }

          const scannedAccountsCount = skippedAccounts.length > 0 ? 0 : 1;

          const summary = {
            scannedAccountsCount,
            totalAccountsCount: 1,
            importedCount: groupedInputs.size,
            skippedAccounts,
            missingItems: missingItems.length > 0 ? missingItems : undefined,
            extraItems: extraItems.length > 0 ? extraItems : undefined,
            storageUnits:
              syncedStorageUnits.length > 0 ? syncedStorageUnits : undefined,
          };

          // Update lastSyncedAt for this account
          await db.collection("portfolio_accounts").updateOne(
            { _id: targetAccount._id },
            { $set: { lastSyncedAt: new Date() } }
          );

          const changesMsg = [
            missingItems.length > 0 ? `thiếu ${missingItems.length} loại` : "",
            extraItems.length > 0 ? `thừa ${extraItems.length} loại` : ""
          ].filter(Boolean).join(" và ");
          const messageDetail = changesMsg ? ` Phát hiện ${changesMsg}.` : "";

          send({
            type: "complete",
            message: `Đồng bộ thành công tài khoản ${accountName}.${messageDetail}`,
            percent: 100,
            summary,
          });
        } catch (error) {
          send({
            type: "error",
            message: error instanceof Error ? error.message : "Đồng bộ thất bại.",
            percent: 100,
          });
        } finally {
          controller.close();
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
  } catch (error) {
    console.error("Single sync handler error:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Đồng bộ thất bại." },
      { status: 500 },
    );
  }
}

function processScanResult(
  scanResult: ScanResult,
  account: { name?: string; steamId64: string | number },
  allScannedItems: SyncScannedItem[],
  allScannedStorageUnits: Array<{
    steamId64: string;
    assetId: string;
    name: string;
    iconUrl: string | null;
  }>,
) {
  const accountName = String(account.name || "Unknown");
  const steamId64 = String(account.steamId64);

  if (scanResult.items && Array.isArray(scanResult.items)) {
    for (const item of scanResult.items) {
      const quantity = Number(item.quantity);
      const holdDays =
        typeof item.holdDays === "number" && item.holdDays > 0
          ? item.holdDays
          : 0;
      const onMarket = item.onMarket === true;
      const tradeProtected = item.tradeProtected === true;

      const itemSourceAccount: PortfolioSourceAccount = {
        steamId64,
        name: accountName,
        breakdown: {
          tradeable: !holdDays && !onMarket && !tradeProtected ? quantity : 0,
          onMarket: onMarket ? quantity : 0,
          tradeProtected: tradeProtected ? quantity : 0,
          hold: holdDays > 0 ? quantity : 0,
          holdDetails: holdDays > 0 ? [{ quantity, holdDays, tradeHoldUntil: item.tradeHoldUntil }] : [],
        },
      };

      allScannedItems.push({
        caseItem: {
          id: String(item.caseItem?.id || ""),
          name: String(item.caseItem?.name || ""),
          marketHashName: String(item.caseItem?.marketHashName || ""),
          imageUrl: item.caseItem?.imageUrl
            ? String(item.caseItem.imageUrl)
            : null,
        },
        rarity: normalizeRarity(item.rarity),
        quantity,
        price: Number(item.price),
        sourceAccounts: [itemSourceAccount],
        holdDays: holdDays > 0 ? holdDays : undefined,
        tradeHoldUntil: holdDays > 0 ? item.tradeHoldUntil : undefined,
        onMarket: onMarket || undefined,
        tradeProtected: tradeProtected || undefined,
      });
    }
  }

  if (scanResult.storageUnits && Array.isArray(scanResult.storageUnits)) {
    for (const su of scanResult.storageUnits) {
      allScannedStorageUnits.push({
        steamId64,
        assetId: String(su.assetId || ""),
        name: String(su.name || "Storage Unit"),
        iconUrl: su.iconUrl ? String(su.iconUrl) : null,
      });
    }
  }
}

async function pollJobProgress(
  origin: string,
  jobId: string,
  onProgress: (progress: {
    stage: string;
    message: string;
    percent: number;
    detail?: Record<string, number | string>;
  }) => void,
): Promise<Record<string, unknown>> {
  const TIMEOUT_MS = 5 * 60 * 1000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < TIMEOUT_MS) {
    const res = await fetch(
      `${origin}/api/inventory/scan?jobId=${encodeURIComponent(jobId)}`,
      {
        cache: "no-store",
      },
    );

    if (!res.ok) {
      throw new Error("Không thể đọc tiến độ quét.");
    }

    const progress = await res.json();

    onProgress({
      stage: progress.stage ?? "running",
      message: progress.message ?? "Đang quét...",
      percent: progress.percent ?? 0,
      detail: progress.detail,
    });

    if (progress.status === "done") {
      return (progress.result ?? {}) as Record<string, unknown>;
    }

    if (progress.status === "error") {
      throw new Error(progress.error ?? progress.message ?? "Quét thất bại.");
    }

    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  throw new Error("Quét inventory quá lâu. Hãy thử lại sau.");
}

async function createImportedCase(
  db: Db,
  input: {
    name: string;
    marketHashName: string;
    imageUrl?: string;
    rarity?: SyncScannedItem["rarity"];
  },
) {
  const now = new Date();
  const collection = db.collection("cases");
  await collection.updateOne(
    { marketHashName: input.marketHashName },
    {
      $set: {
        name: input.name,
        marketHashName: input.marketHashName,
        imageUrl: input.imageUrl,
        ...(input.rarity ? { rarity: input.rarity } : {}),
        isActive: true,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );
  const doc = await collection.findOne({
    marketHashName: input.marketHashName,
  });
  return doc
    ? {
        id: doc._id.toString(),
        name: doc.name,
        marketHashName: doc.marketHashName,
        imageUrl: doc.imageUrl,
      }
    : null;
}

async function updateImportedCaseMetadata(
  db: Db,
  input: {
    marketHashName: string;
    imageUrl?: string;
    rarity?: SyncScannedItem["rarity"];
  },
) {
  const $set: Record<string, unknown> = { updatedAt: new Date() };
  if (input.imageUrl) {
    $set.imageUrl = input.imageUrl;
  }
  if (input.rarity) {
    $set.rarity = input.rarity;
  }

  await db
    .collection("cases")
    .updateOne({ marketHashName: input.marketHashName }, { $set });
}

function getOwnerFilter(ownerId: string) {
  if (ownerId === "guest") {
    return {
      $or: [{ ownerId: "guest" }, { ownerId: { $exists: false } }],
    };
  }
  return { ownerId };
}
