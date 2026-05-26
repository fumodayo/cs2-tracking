import { NextRequest, NextResponse } from "next/server";
import { createServices } from "@/infrastructure/container";
import { serializeReport } from "@/services/dto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { portfolioReportService } = createServices();
    const report = await portfolioReportService.buildReport();

    return NextResponse.json(serializeReport(report));
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { portfolioService, portfolioReportService } = createServices();

    await portfolioService.create({
      caseId: String(body.caseId ?? ""),
      quantity: Number(body.quantity),
      buyPrice: Number(body.buyPrice),
      buyDate: new Date(body.buyDate ?? Date.now()),
      note: body.note ? String(body.note) : undefined,
    });

    const report = await portfolioReportService.buildReport();
    return NextResponse.json(serializeReport(report), { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 400 });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Không thể xử lý portfolio.";
}
