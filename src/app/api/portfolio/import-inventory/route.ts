import { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getErrorMessage } from '@/utils/error';
import type { CaseItem } from '@/domain/case-item';
import type { CreatePortfolioItemInput } from '@/domain/portfolio-item';
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
import {
  getOptionalDate,
  getOptionalNumber,
  getOptionalString,
  normalizeItems,
  normalizePatternInfo,
  normalizeSourceAccounts,
} from './import-inventory-payload';
import { saveImportedPortfolioAccounts } from './import-inventory-account-links';
import { assignManualItemsToStorageUnits } from './import-inventory-storage-units';
import type { ScannedImportInput, StorageUnitAssignment } from './import-inventory-types';
import { publishPortfolioChanged } from '@/services/realtime/portfolio-events';

export const dynamic = 'force-dynamic';

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
        const ownerId = await getPortfolioOwnerId();
        const { caseRepository, portfolioService, priceService } = createServices({
          ownerId,
        });

        const now = new Date();
        const manualInputs: CreatePortfolioItemInput[] = [];
        const scannedInputs = new Map<string, ScannedImportInput>();
        const storageUnitAssignments: StorageUnitAssignment[] = [];

        const skipped: string[] = [];
        const totalItems = items.length;

        // Nạp trước toàn bộ case để tối ưu các lookup N+1
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
          // Ưu tiên giá sticker do client ghi nhận, nhưng điền trường còn thiếu từ giá phụ kiện hiện tại.
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

          // Ưu tiên resolve từ cache
          let resolvedCaseItem =
            (marketHashName ? casesMap.get(marketHashName) : null) ??
            (rawCaseId ? casesByIdMap.get(rawCaseId) : null);

          // Nếu không có trong cache thì truy vấn repository làm dự phòng hoặc tạo mới
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

            // Thêm vào cache để tránh lookup N+1 cho case mới này về sau
            if (resolvedCaseItem) {
              casesMap.set(resolvedCaseItem.marketHashName, resolvedCaseItem);
              casesByIdMap.set(String(resolvedCaseItem.id), resolvedCaseItem);
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
                imageUrl,
                rarity,
              });

              // Cập nhật cache cục bộ
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
            // Vật phẩm quét được gom theo định danh và trạng thái giao dịch để đồng bộ so sánh lô cũ/mới.
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
              // Giữ ngày trade-hold mới nhất khi nhiều dòng quét được gộp thành một nhóm.
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

          // Gửi tiến độ mỗi 3 vật phẩm hoặc ở vật phẩm cuối
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

        // Lưu vào portfolio
        sendProgress({
          type: 'progress',
          message: `importProgressSavingItems:count=${scannedInputs.size + manualInputs.length}`,
          percent: 75,
          step: 'save',
        });

        // Xóa vật phẩm quét tự động và vật phẩm scanner nhập tay hiện có
        let existingPortfolioItems: ExistingPortfolioItem[] = [];
        try {
          const db = await getDatabase();
          const portfolioCol = db.collection('portfolio_items');
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
          // So sánh tổng quét mới với ghi chú scanner đã xóa để giữ lịch sử giao dịch.
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

        // Gán vật phẩm nhập tay vào storage unit nếu có chỉ định
        await assignManualItemsToStorageUnits(storageUnitAssignments, ownerId);

        sendProgress({
          type: 'progress',
          message: 'importProgressLinkingAccounts',
          percent: 85,
          step: 'accounts',
        });

        // Lưu tài khoản portfolio
        await saveImportedPortfolioAccounts({
          ownerId,
          scannedInputs: scannedInputs.values(),
          manualInputs,
          bodyAccounts: body.accounts,
          sendProgress,
        });

        const totalSavedCount = scannedInputs.size + manualInputs.length;
        await publishPortfolioChanged(ownerId, 'imported', {
          count: totalSavedCount,
          skipped: skipped.length,
        });
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
