import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/infrastructure/db/mongo-client';
import { getPortfolioOwnerId } from '@/services/auth-service';
import { decrypt } from '@/services/crypto-service';
import { createServices } from '@/infrastructure/container';
import { ObjectId } from 'mongodb';
import { getOwnerFilter } from '@/infrastructure/db/owner-filter';
import { getCachedScan } from '@/services/scan-cache';
import { publishPortfolioChanged } from '@/services/realtime/portfolio-events';
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
  buildSyncChangeSummary,
  createImportedCase,
  updateImportedCaseMetadata,
  type ExistingPortfolioItem,
  type SyncScannedItem,
  type GroupedInput,
  type SyncProgressEvent,
  type SyncStorageUnit,
  type ScanResult,
} from '@/services/portfolio-sync';

export const dynamic = 'force-dynamic';

type PortfolioAccountDb = {
  _id: ObjectId;
  name?: string;
  steamId64: string | number;
  avatarUrl?: string | null;
  steamUrl?: string;
  steamCookie?: string;
  lastSyncedAt?: Date | string;
};

export async function POST(request: NextRequest) {
  try {
    const ownerId = await getPortfolioOwnerId();
    const db = await getDatabase();

    const body = await request.json().catch(() => ({}));
    const { accountId } = body;

    if (!accountId || !ObjectId.isValid(accountId)) {
      return NextResponse.json({ message: 'invalidAccountId' }, { status: 400 });
    }

    const targetAccount = (await db.collection('portfolio_accounts').findOne({
      _id: new ObjectId(accountId),
      ...getOwnerFilter(ownerId),
    })) as unknown as PortfolioAccountDb | null;

    if (!targetAccount) {
      return NextResponse.json({ message: 'accountNotFound' }, { status: 404 });
    }

    const lastSyncedAt = targetAccount.lastSyncedAt;
    const cooldownMs = 5 * 60 * 1000;
    if (lastSyncedAt && Date.now() - new Date(lastSyncedAt).getTime() < cooldownMs) {
      const remainingMs = cooldownMs - (Date.now() - new Date(lastSyncedAt).getTime());
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      return NextResponse.json(
        { message: `accountCooldown:seconds=${remainingSeconds}` },
        { status: 429 }
      );
    }

    const allAccounts = (await db
      .collection('portfolio_accounts')
      .find(getOwnerFilter(ownerId))
      .toArray()) as unknown as PortfolioAccountDb[];

    const origin = request.nextUrl.origin;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false;
        // Route này stream Server-Sent Events, nên cần chặn gọi close/enqueue lặp.
        const send = (event: SyncProgressEvent) => {
          if (isClosed) return;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
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

          const accountName = String(targetAccount.name || 'Steam Account');
          const targetSteamId64 = String(targetAccount.steamId64);

          // 1. Quét trực tiếp tài khoản mục tiêu
          send({
            type: 'account_start',
            accountIndex: 0,
            totalAccounts: 1,
            accountName,
            steamId64: targetSteamId64,
            avatarUrl: targetAccount.avatarUrl ?? null,
            message: `syncStartingScan:name=${accountName}`,
            percent: 0,
          });

          let targetScanResult: ScanResult | null = null;
          let targetScanErrorMessage: string | null = null;
          try {
            const rawCookie = targetAccount.steamCookie
              ? decrypt(targetAccount.steamCookie)
              : undefined;
            const jobId = await startInventoryScanJob({
              steamUrl: targetAccount.steamUrl ?? '',
              steamCookie: rawCookie?.trim() || undefined,
              forceRefresh: true,
              ownerId,
            });

            // Polling tiến độ
            targetScanResult = await pollJobProgress(origin, jobId, (progress) => {
              send({
                type: 'account_progress',
                accountIndex: 0,
                totalAccounts: 1,
                accountName,
                steamId64: targetSteamId64,
                avatarUrl: targetAccount.avatarUrl ?? null,
                message: progress.message,
                percent: Math.round(progress.percent * 0.8), // 0% to 80%
                scanProgress: progress,
              });
            });

            // Xử lý kết quả quét trực tiếp
            processScanResult(
              targetScanResult,
              targetAccount,
              allScannedItems,
              allScannedStorageUnits
            );

            send({
              type: 'account_done',
              accountIndex: 0,
              totalAccounts: 1,
              accountName,
              steamId64: targetSteamId64,
              avatarUrl: targetAccount.avatarUrl ?? null,
              message: `syncDoneScan:name=${accountName},count=${Array.isArray(targetScanResult?.items) ? targetScanResult.items.length : 0}`,
              percent: 80,
            });
          } catch (scanError) {
            console.error(`Error scanning account ${accountName}:`, scanError);
            skippedAccounts.push(accountName);
            targetScanErrorMessage =
              scanError instanceof Error ? scanError.message : 'Unknown error';

            send({
              type: 'account_error',
              accountIndex: 0,
              totalAccounts: 1,
              accountName,
              steamId64: targetSteamId64,
              avatarUrl: targetAccount.avatarUrl ?? null,
              message: `syncErrorScan:name=${accountName},error=${scanError instanceof Error ? scanError.message : 'Unknown error'}`,
              percent: 80,
            });
          }

          if (!targetScanResult) {
            send({
              type: 'error',
              message: `syncErrorScan:name=${accountName},error=${targetScanErrorMessage ?? 'scanFailed'}`,
              percent: 100,
            });
            close();
            return;
          }

          // 2. Nạp kết quả quét trong cache cho các tài khoản còn lại
          send({
            type: 'import_start',
            message: 'syncFetchingCacheOtherAccounts',
            percent: 82,
          });

          for (const account of allAccounts) {
            const currentSteamId = String(account.steamId64);
            if (currentSteamId === targetSteamId64) continue;

            try {
              // Đồng bộ một tài khoản chỉ quét lại tài khoản mục tiêu; các tài khoản khác dùng cache
              // để so sánh thiếu/thừa vẫn có đủ ngữ cảnh portfolio.
              const cached = ((await getCachedScan({
                steamId64: currentSteamId,
                ownerId,
                hasCookie: true,
              })) ??
                (await getCachedScan({
                  steamId64: currentSteamId,
                  hasCookie: false,
                }))) as unknown as ScanResult | null;

              if (cached) {
                processScanResult(cached, account, allScannedItems, allScannedStorageUnits);
              }
            } catch (cacheError) {
              console.error(`Error loading cache for ${account.name}:`, cacheError);
            }
          }

          // 3. Giai đoạn import
          send({
            type: 'import_start',
            message: `syncImportingItems:count=${allScannedItems.length}`,
            percent: 85,
          });

          if (allScannedItems.length === 0) {
            send({
              type: 'error',
              message: 'syncFailedNoInventoryLoaded',
              percent: 100,
            });
            close();
            return;
          }

          // Đọc portfolio hiện có để so sánh vật phẩm thiếu trước khi xóa
          const portfolioCol = db.collection('portfolio_items');
          const existingPortfolioItems = (await portfolioCol
            .find({
              ...getOwnerFilter(ownerId),
              note: { $in: [...SCANNER_IMPORT_NOTES] },
            })
            .toArray()) as unknown as ExistingPortfolioItem[];

          // Xóa các vật phẩm quét tự động hiện có
          await portfolioCol.deleteMany({
            ...getOwnerFilter(ownerId),
            note: { $in: [...SCANNER_IMPORT_NOTES] },
          });

          // Gom nhóm và resolve vật phẩm
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
            rarity?: SyncScannedItem['rarity'];
          };

          // Nạp trước toàn bộ case để tối ưu các lookup N+1
          const allCasesDocs = await db.collection('cases').find({ isActive: true }).toArray();
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

            if (!Number.isFinite(quantity) || quantity <= 0) {
              skippedItems.push(marketHashName || 'unknown');
              continue;
            }

            // Ưu tiên resolve từ cache
            let resolvedCaseItem =
              (marketHashName ? casesMap.get(marketHashName) : null) ??
              (rawCaseId ? casesByIdMap.get(rawCaseId) : null);

            // Nếu không có trong cache thì truy vấn database/repository làm dự phòng
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
                    'rarity' in fallbackItem
                      ? (fallbackItem.rarity as SyncScannedItem['rarity'])
                      : undefined,
                };
                casesMap.set(resolvedCaseItem.marketHashName, resolvedCaseItem);
                casesByIdMap.set(resolvedCaseItem.id, resolvedCaseItem);
              }
            }

            // Chỉ cập nhật metadata khi ảnh hoặc độ hiếm thật sự đổi hoặc đang thiếu trong database
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
                  imageUrl: imageUrl ?? undefined,
                  rarity,
                });

                // Cập nhật cache cục bộ
                if (hasNewImage) resolvedCaseItem.imageUrl = imageUrl;
                if (hasNewRarity) resolvedCaseItem.rarity = rarity;
              }
            }

            if (!resolvedCaseItem) {
              skippedItems.push(marketHashName || 'unknown');
              continue;
            }

            const stickerFields = await buildAccessoryPriceFields(item.patternInfo, priceService);
            const priceWithSticker = Math.round(price + (stickerFields.stickerBuyPriceAdd ?? 0));
            // Gom theo định danh vật phẩm, không theo tài khoản, rồi gộp tài khoản nguồn vào nhóm.
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
              // Giữ ngày hold xa nhất khi nhiều dòng tài khoản được gộp.
              if (item.tradeHoldUntil) {
                if (
                  !updatedTradeHoldUntil ||
                  new Date(item.tradeHoldUntil).getTime() >
                    new Date(updatedTradeHoldUntil).getTime()
                ) {
                  updatedTradeHoldUntil = item.tradeHoldUntil;
                }
              }
              groupedInputs.set(groupKey, {
                ...existing,
                quantity: nextQuantity,
                buyPrice: Math.round(
                  (existing.buyPrice * existing.quantity + priceWithSticker * quantity) /
                    nextQuantity
                ),
                sourceAccounts: mergeSourceAccounts(existing.sourceAccounts, sourceAccounts),
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

          // Thêm các vật phẩm mới
          const buyDate = new Date();
          if (groupedInputs.size > 0) {
            // So sánh chênh lệch với lần import scanner trước để báo vật phẩm đã bán hoặc bị thiếu.
            const resolvedInputs = Array.from(groupedInputs.values()).flatMap((input) => {
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
                }
              );
            });

            if (resolvedInputs.length > 0) {
              await portfolioService.createMany(resolvedInputs);
            }
          }

          send({
            type: 'import_done',
            message: `syncImportedGroupedItems:count=${groupedInputs.size}`,
            percent: 90,
          });

          // Upsert Storage Unit từ kết quả quét
          let syncedStorageUnits: SyncStorageUnit[] = [];
          if (allScannedStorageUnits.length > 0) {
            const suCol = db.collection('storage_units');
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
                { upsert: true }
              );
            }

            // Lấy toàn bộ storage unit của owner này để đưa vào kết quả
            const allSUs = await suCol.find(getOwnerFilter(ownerId)).toArray();
            syncedStorageUnits = allSUs.map((doc) => ({
              id: doc._id.toString(),
              name: String(doc.name),
              steamId64: String(doc.steamId64),
              currentCount: Array.isArray(doc.items)
                ? doc.items.reduce(
                    (sum: number, item: Record<string, unknown>) =>
                      sum + (Number(item.quantity) || 0),
                    0
                  )
                : 0,
            }));
          }

          const { missingItems, extraItems } = await buildSyncChangeSummary({
            existingPortfolioItems,
            groupedInputs,
            caseRepository,
            targetSteamId64,
          });

          const scannedAccountsCount = skippedAccounts.length > 0 ? 0 : 1;

          const summary = {
            scannedAccountsCount,
            totalAccountsCount: 1,
            importedCount: groupedInputs.size,
            skippedAccounts,
            missingItems: missingItems.length > 0 ? missingItems : undefined,
            extraItems: extraItems.length > 0 ? extraItems : undefined,
            storageUnits: syncedStorageUnits.length > 0 ? syncedStorageUnits : undefined,
          };

          // Cập nhật lastSyncedAt cho tài khoản này
          await db
            .collection('portfolio_accounts')
            .updateOne(
              { _id: targetAccount._id, ...getOwnerFilter(ownerId) },
              { $set: { lastSyncedAt: new Date() } }
            );

          await publishPortfolioChanged(ownerId, 'synced', {
            importedCount: summary.importedCount,
            scannedAccountsCount: summary.scannedAccountsCount,
            totalAccountsCount: summary.totalAccountsCount,
            steamId64: targetSteamId64,
          });

          send({
            type: 'complete',
            message: `syncSingleComplete:name=${accountName},missingCount=${missingItems.length},extraCount=${extraItems.length}`,
            percent: 100,
            summary,
          });
        } catch (error) {
          send({
            type: 'error',
            message: error instanceof Error ? error.message : 'syncFailed',
            percent: 100,
          });
        } finally {
          close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Single sync handler error:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'syncFailed' },
      { status: 500 }
    );
  }
}
