import { NextRequest, NextResponse } from "next/server";
import { createServices } from "@/infrastructure/container";
import { getPortfolioOwnerId } from "@/services/auth-service";
import { serializeReport } from "@/services/dto";
import type { PortfolioImportRowInput } from "@/services/portfolio-import-service";
import { getErrorMessage } from "@/utils/error";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rows = normalizeRows(body.rows);
    const ownerId = await getPortfolioOwnerId();
    const { portfolioService, caseRepository, portfolioReportService } = createServices({
      ownerId,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: unknown) => {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        };

        try {
          const inputs = [];
          const total = rows.length;

          for (const [index, row] of rows.entries()) {
            const name = row.marketHashName || row.caseId || "item";
            send({
              type: "progress",
              stage: "resolving",
              index,
              total,
              name,
              message: `importProgressProcessingItem:current=${index + 1},total=${total},name=${name}`,
            });

            let caseId: string;
            if (row.caseId) {
              const caseItem = await caseRepository.findById(row.caseId);
              if (caseItem) {
                caseId = caseItem.id;
              } else {
                throw new Error(`importErrorRowCaseIdNotFound:row=${index + 2}`);
              }
            } else if (row.marketHashName) {
              const resolvedCase = await caseRepository.findOrCreateByMarketHashName(
                row.marketHashName
              );
              caseId = resolvedCase.id;
            } else {
              throw new Error(`importErrorRowMissingCaseIdOrName:row=${index + 2}`);
            }

            inputs.push({
              caseId,
              quantity: row.quantity,
              buyPrice: row.buyPrice,
              buyDate: row.buyDate,
              note: row.note,
            });
          }

          send({
            type: "progress",
            stage: "saving",
            message: `importProgressSavingItems:count=${total}`,
          });

          const createdItems = await portfolioService.createMany(inputs);
          const importResult = {
            importedCount: createdItems.length,
            importedIds: createdItems.map((item) => item.id),
          };

          send({
            type: "progress",
            stage: "building_report",
            message: "importProgressBuildingReport",
          });

          const report = await portfolioReportService.buildReport({
            refreshStalePrices: false,
          });

          send({
            type: "complete",
            result: { ...serializeReport(report), importResult },
          });
        } catch (err) {
          send({
            type: "error",
            message: err instanceof Error ? err.message : "importErrorGenericWithReason",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "importErrorGeneric") },
      { status: 400 },
    );
  }
}

function normalizeRows(value: unknown): PortfolioImportRowInput[] {
  if (!Array.isArray(value)) {
    throw new Error("importErrorInvalidPayload");
  }

  return value.map((row, index) => normalizeRow(row, index));
}

function normalizeRow(value: unknown, index: number): PortfolioImportRowInput {
  if (!isRecord(value)) {
    throw new Error(`importErrorRowInvalidData:row=${index + 2}`);
  }

  const quantity = Number(value.quantity);
  const buyPrice = Number(value.buyPrice);
  const buyDate = new Date(String(value.buyDate ?? ""));

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`importErrorRowInvalidQuantity:row=${index + 2}`);
  }

  if (!Number.isFinite(buyPrice) || buyPrice <= 0) {
    throw new Error(`importErrorRowInvalidPrice:row=${index + 2}`);
  }

  if (Number.isNaN(buyDate.getTime())) {
    throw new Error(`importErrorRowInvalidDate:row=${index + 2}`);
  }

  return {
    caseId: getOptionalString(value.caseId),
    marketHashName: getOptionalString(value.marketHashName),
    quantity,
    buyPrice,
    buyDate,
    note: getOptionalString(value.note),
  };
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
