import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import type { CaseItem } from "@/domain/case-item";
import type {
  PortfolioSourceAccount,
  CreatePortfolioItemInput,
} from "@/domain/portfolio-item";
import {
  updateSourceAccounts,
  resolveSyncTransactions,
  type ExistingPortfolioItem,
} from "@/utils/portfolio-sync";
import { createServices } from "@/infrastructure/container";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { mapCaseDocument } from "@/infrastructure/db/mappers";
import { getCurrentUser, getPortfolioOwnerId } from "@/services/auth-service";
import { encrypt } from "@/services/crypto-service";

export const dynamic = "force-dynamic";

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
  storageUnitId?: unknown;
  buffPriceManual?: unknown;
  buffRateManual?: unknown;
};

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendProgress(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      }

      try {
        const user = await getCurrentUser();
        if (!user) {
          sendProgress({
            type: "error",
            message:
              "Hãy đăng nhập Gmail trước khi lưu inventory vào portfolio cá nhân.",
          });
          controller.close();
          return;
        }

        const body = await request.json();
        const items = normalizeItems(body.items);
        const { caseRepository, portfolioService } = createServices({
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
        const allCasesDocs = await db
          .collection("cases")
          .find({ isActive: true })
          .toArray();
        const casesMap = new Map<string, CaseItem>();
        const casesByIdMap = new Map<string, CaseItem>();
        for (const doc of allCasesDocs) {
          const mapped = mapCaseDocument(doc);
          casesMap.set(mapped.marketHashName, mapped);
          casesByIdMap.set(String(mapped.id), mapped);
        }

        sendProgress({
          type: "progress",
          message: `Đang xử lý ${totalItems} loại item...`,
          percent: 0,
          step: "resolve",
        });

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const marketHashName = getOptionalString(
            item.caseItem?.marketHashName,
          );
          const rawCaseId = getOptionalString(item.caseItem?.id);
          const caseName =
            getOptionalString(item.caseItem?.name) ?? marketHashName;
          const imageUrl = getOptionalString(item.caseItem?.imageUrl);
          const rarity =
            normalizeRarity(item.rarity) ??
            normalizeRarity(item.caseItem?.rarity);
          const quantity = Number(item.quantity);
          const price = Number(item.price);
          const isManual = item.isManual === true;
          const sourceAccounts = normalizeSourceAccounts(item.sourceAccounts);
          const holdDays =
            typeof item.holdDays === "number" && item.holdDays > 0
              ? item.holdDays
              : 0;

          if (
            !Number.isFinite(quantity) ||
            quantity <= 0 ||
            !Number.isFinite(price) ||
            price <= 0
          ) {
            skipped.push(marketHashName ?? rawCaseId ?? "unknown");
            continue;
          }

          // Try resolving from cache first
          let resolvedCaseItem =
            (marketHashName ? casesMap.get(marketHashName) : null) ??
            (rawCaseId ? casesByIdMap.get(rawCaseId) : null);

          // If not found in cache, query the repository (fallback) or create it
          if (!resolvedCaseItem) {
            resolvedCaseItem =
              (marketHashName
                ? await caseRepository.findByMarketHashName(marketHashName)
                : null) ??
              (rawCaseId && ObjectId.isValid(rawCaseId)
                ? await caseRepository.findById(rawCaseId)
                : null) ??
              (marketHashName
                ? await createImportedCase({
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
              imageUrl &&
              (!resolvedCaseItem.imageUrl ||
                resolvedCaseItem.imageUrl !== imageUrl);
            const hasNewRarity =
              rarity &&
              (!resolvedCaseItem.rarity ||
                resolvedCaseItem.rarity.name !== rarity.name ||
                resolvedCaseItem.rarity.color !== rarity.color);

            if (hasNewImage || hasNewRarity) {
              await updateImportedCaseMetadata({
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
            skipped.push(marketHashName ?? rawCaseId ?? "unknown");
            continue;
          }

          if (isManual) {
            const itemBuyPrice =
              typeof item.buyPrice === "number" ? item.buyPrice : price;
            const buyDateStr =
              typeof item.buyDate === "string" ? item.buyDate : null;
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
              note: "Thủ công từ inventory scanner",
              tradeHoldUntil:
                holdDays > 0
                  ? new Date(
                      itemBuyDate.getTime() + holdDays * 24 * 60 * 60 * 1000,
                    )
                  : undefined,
              storageUnitId: storageUnitId || undefined,
            });
          } else {
            const existing = scannedInputs.get(resolvedCaseItem.id);
            if (existing) {
              const nextQuantity = existing.quantity + quantity;
              scannedInputs.set(resolvedCaseItem.id, {
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
                holdDays: Math.max(existing.holdDays, holdDays),
              });
            } else {
              scannedInputs.set(resolvedCaseItem.id, {
                caseId: resolvedCaseItem.id,
                quantity,
                buyPrice: Math.round(price),
                note: "Import từ inventory scanner",
                sourceAccounts,
                holdDays,
              });
            }
          }

          // Send progress every 3 items or on last item
          if ((i + 1) % 3 === 0 || i === items.length - 1) {
            const percent = Math.round(((i + 1) / totalItems) * 70);
            sendProgress({
              type: "progress",
              message: `Đang xử lý item ${i + 1}/${totalItems}: ${caseName ?? marketHashName ?? "..."}`,
              percent,
              step: "resolve",
              detail: { processed: i + 1, total: totalItems },
            });
          }
        }

        if (scannedInputs.size === 0 && manualInputs.length === 0) {
          sendProgress({
            type: "error",
            message: "Không có item hợp lệ để lưu vào portfolio.",
          });
          controller.close();
          return;
        }

        // Save to portfolio
        sendProgress({
          type: "progress",
          message: `Đang lưu ${scannedInputs.size + manualInputs.length} loại item vào portfolio...`,
          percent: 75,
          step: "save",
        });

        // Clear existing automated scan items and manual scanner items
        let existingPortfolioItems: ExistingPortfolioItem[] = [];
        try {
          const db = await getDatabase();
          const portfolioCol = db.collection("portfolio_items");
          const ownerId = await getPortfolioOwnerId();
          const ownerFilter =
            ownerId === "guest"
              ? { $or: [{ ownerId: "guest" }, { ownerId: { $exists: false } }] }
              : { ownerId };

          existingPortfolioItems = (await portfolioCol
            .find({
              ...ownerFilter,
              note: {
                $in: [
                  "Import từ inventory scanner",
                  "Thủ công từ inventory scanner",
                ],
              },
            })
            .toArray()) as unknown as ExistingPortfolioItem[];

          await portfolioCol.deleteMany({
            ...ownerFilter,
            note: {
              $in: [
                "Import từ inventory scanner",
                "Thủ công từ inventory scanner",
              ],
            },
          });
        } catch (clearError) {
          console.error(
            "Failed to clear previous portfolio scan items:",
            clearError,
          );
        }

        const finalInputs: CreatePortfolioItemInput[] = [...manualInputs];

        if (scannedInputs.size > 0) {
          const resolvedScanned = Array.from(scannedInputs.values()).flatMap(
            (input) => {
              return resolveSyncTransactions(
                input.caseId,
                input.quantity,
                input.buyPrice,
                input.sourceAccounts,
                input.holdDays,
                existingPortfolioItems,
                now,
                "Import từ inventory scanner",
              );
            },
          );
          finalInputs.push(...resolvedScanned);
        }

        if (finalInputs.length > 0) {
          await portfolioService.createMany(finalInputs);
        }

        // Assign manual items to storage units if specified
        if (storageUnitAssignments.length > 0) {
          try {
            const db = await getDatabase();
            const suCollection = db.collection("storage_units");
            const ownerId = await getPortfolioOwnerId();

            for (const assign of storageUnitAssignments) {
              const suDoc = await suCollection.findOne({
                _id: new ObjectId(assign.storageUnitId),
                ownerId,
              });
              if (suDoc) {
                const existingItems = Array.isArray(suDoc.items)
                  ? suDoc.items
                  : [];
                const updatedItems = [...existingItems];
                const existingIdx = updatedItems.findIndex(
                  (ei) => (ei as { caseId?: string }).caseId === assign.caseId,
                );

                if (existingIdx >= 0) {
                  updatedItems[existingIdx] = {
                    ...updatedItems[existingIdx],
                    quantity:
                      updatedItems[existingIdx].quantity + assign.quantity,
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
                  { _id: new ObjectId(assign.storageUnitId) },
                  { $set: { items: updatedItems, updatedAt: new Date() } },
                );
              }
            }
          } catch (suError) {
            console.error(
              "Failed to assign manual items to storage units:",
              suError,
            );
          }
        }

        sendProgress({
          type: "progress",
          message: "Đang liên kết tài khoản Steam...",
          percent: 85,
          step: "accounts",
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
            const accountsCollection = db.collection("portfolio_accounts");
            const cacheCollection = db.collection("inventory_scan_cache");
            const now = new Date();

            // Build a map of steamId64 to steamCookie from frontend payload
            const clientAccounts = Array.isArray(body.accounts)
              ? body.accounts
              : [];
            const cookieMap = new Map<string, string>();
            for (const a of clientAccounts) {
              if (
                a &&
                typeof a.steamId64 === "string" &&
                typeof a.steamCookie === "string"
              ) {
                const trimmed = a.steamCookie.trim();
                if (trimmed) cookieMap.set(a.steamId64, trimmed);
              }
            }

            let accIdx = 0;
            for (const account of allUniqueAccounts.values()) {
              const cacheDoc = await cacheCollection.findOne({
                steamId64: account.steamId64,
              });
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
                $setFields.steamCookie = encrypt(clientCookie);
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
                { upsert: true },
              );
              accIdx++;
              sendProgress({
                type: "progress",
                message: `Đang liên kết tài khoản ${accIdx}/${allUniqueAccounts.size}: ${account.name}`,
                percent:
                  85 + Math.round((accIdx / allUniqueAccounts.size) * 10),
                step: "accounts",
              });
            }
          }
        } catch (saveAccountsError) {
          console.error(
            "Failed to automatically save portfolio accounts:",
            saveAccountsError,
          );
        }

        const totalSavedCount = scannedInputs.size + manualInputs.length;
        sendProgress({
          type: "done",
          message: `Đã lưu ${totalSavedCount} loại item vào portfolio cá nhân${skipped.length ? `, bỏ qua ${skipped.length} item chưa hỗ trợ` : ""}.`,
          percent: 100,
          importResult: {
            importedCount: totalSavedCount,
            skippedCount: skipped.length,
            skipped,
          },
        });
        controller.close();
      } catch (error) {
        sendProgress({ type: "error", message: getErrorMessage(error) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}

function normalizeItems(value: unknown): InventoryImportItem[] {
  if (!Array.isArray(value)) {
    throw new Error("Payload inventory không hợp lệ.");
  }

  return value.filter(isRecord) as InventoryImportItem[];
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSourceAccounts(value: unknown): PortfolioSourceAccount[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((account) => {
      const breakdownVal = isRecord(account.breakdown)
        ? account.breakdown
        : undefined;
      const breakdown = breakdownVal
        ? {
            tradeable:
              typeof breakdownVal.tradeable === "number"
                ? breakdownVal.tradeable
                : 0,
            onMarket:
              typeof breakdownVal.onMarket === "number"
                ? breakdownVal.onMarket
                : 0,
            tradeProtected:
              typeof breakdownVal.tradeProtected === "number"
                ? breakdownVal.tradeProtected
                : 0,
            hold: typeof breakdownVal.hold === "number" ? breakdownVal.hold : 0,
            holdDetails: Array.isArray(breakdownVal.holdDetails)
              ? breakdownVal.holdDetails.filter(isRecord).map((hd) => ({
                  quantity: typeof hd.quantity === "number" ? hd.quantity : 0,
                  holdDays: typeof hd.holdDays === "number" ? hd.holdDays : 0,
                }))
              : undefined,
          }
        : undefined;

      return {
        steamId64: getOptionalString(account.steamId64) ?? "",
        name: getOptionalString(account.name) ?? "",
        breakdown,
      };
    })
    .filter((account) => account.steamId64 && account.name);
}

function normalizeRarity(value: unknown): CaseItem["rarity"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const name = getOptionalString(value.name);
  const color = normalizeHexColor(value.color);
  return name && color ? { name, color } : undefined;
}

function normalizeHexColor(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? `#${normalized}` : undefined;
}

function mergeSourceAccounts(
  first: PortfolioSourceAccount[],
  second: PortfolioSourceAccount[],
): PortfolioSourceAccount[] {
  const map = new Map<string, PortfolioSourceAccount>();
  for (const account of [...first, ...second]) {
    const existing = map.get(account.steamId64);
    if (existing) {
      const mergedBreakdown =
        existing.breakdown || account.breakdown
          ? {
              tradeable:
                (existing.breakdown?.tradeable ?? 0) +
                (account.breakdown?.tradeable ?? 0),
              onMarket:
                (existing.breakdown?.onMarket ?? 0) +
                (account.breakdown?.onMarket ?? 0),
              tradeProtected:
                (existing.breakdown?.tradeProtected ?? 0) +
                (account.breakdown?.tradeProtected ?? 0),
              hold:
                (existing.breakdown?.hold ?? 0) +
                (account.breakdown?.hold ?? 0),
              holdDetails: [
                ...(existing.breakdown?.holdDetails ?? []),
                ...(account.breakdown?.holdDetails ?? []),
              ],
            }
          : undefined;
      map.set(account.steamId64, {
        ...existing,
        breakdown: mergedBreakdown,
      });
    } else {
      map.set(account.steamId64, account);
    }
  }
  return Array.from(map.values());
}

async function createImportedCase(input: {
  name: string;
  marketHashName: string;
  imageUrl?: string;
  rarity?: CaseItem["rarity"];
}): Promise<CaseItem> {
  const db = await getDatabase();
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
  if (!doc) {
    throw new Error(`Không thể tạo case cho ${input.marketHashName}.`);
  }

  return mapCaseDocument(doc);
}

async function updateImportedCaseMetadata(input: {
  marketHashName: string;
  imageUrl?: string;
  rarity?: CaseItem["rarity"];
}): Promise<void> {
  const $set: Record<string, unknown> = { updatedAt: new Date() };
  if (input.imageUrl) {
    $set.imageUrl = input.imageUrl;
  }
  if (input.rarity) {
    $set.rarity = input.rarity;
  }

  await (await getDatabase())
    .collection("cases")
    .updateOne({ marketHashName: input.marketHashName }, { $set });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Không thể import inventory vào portfolio.";
}
