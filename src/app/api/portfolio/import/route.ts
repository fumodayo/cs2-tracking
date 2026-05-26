import { NextRequest, NextResponse } from "next/server";
import { createServices } from "@/infrastructure/container";
import { serializeReport } from "@/services/dto";
import type { PortfolioImportRowInput } from "@/services/portfolio-import-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rows = normalizeRows(body.rows);
    const { portfolioImportService, portfolioReportService } = createServices();

    const result = await portfolioImportService.importRows(rows);
    const report = await portfolioReportService.buildReport();

    return NextResponse.json({ ...serializeReport(report), importResult: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 400 });
  }
}

function normalizeRows(value: unknown): PortfolioImportRowInput[] {
  if (!Array.isArray(value)) {
    throw new Error("Payload import không hợp lệ.");
  }

  return value.map((row, index) => normalizeRow(row, index));
}

function normalizeRow(value: unknown, index: number): PortfolioImportRowInput {
  if (!isRecord(value)) {
    throw new Error(`Dòng ${index + 2}: dữ liệu không hợp lệ.`);
  }

  const quantity = Number(value.quantity);
  const buyPrice = Number(value.buyPrice);
  const buyDate = new Date(String(value.buyDate ?? ""));

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Dòng ${index + 2}: số lượng không hợp lệ.`);
  }

  if (!Number.isFinite(buyPrice) || buyPrice <= 0) {
    throw new Error(`Dòng ${index + 2}: giá mua không hợp lệ.`);
  }

  if (Number.isNaN(buyDate.getTime())) {
    throw new Error(`Dòng ${index + 2}: ngày mua không hợp lệ.`);
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Không thể import portfolio.";
}
