import { NextRequest, NextResponse } from "next/server";
import { createServices } from "@/infrastructure/container";
import { serializeReport } from "@/services/dto";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { portfolioService, portfolioReportService } = createServices();

    const updated = await portfolioService.update(id, {
      quantity: body.quantity === undefined ? undefined : Number(body.quantity),
      buyPrice: body.buyPrice === undefined ? undefined : Number(body.buyPrice),
      buyDate: body.buyDate === undefined ? undefined : new Date(body.buyDate),
      note: body.note === undefined ? undefined : String(body.note),
    });

    if (!updated) {
      return NextResponse.json({ message: "Không tìm thấy item." }, { status: 404 });
    }

    const report = await portfolioReportService.buildReport();
    return NextResponse.json(serializeReport(report));
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { portfolioService, portfolioReportService } = createServices();
    const deleted = await portfolioService.delete(id);

    if (!deleted) {
      return NextResponse.json({ message: "Không tìm thấy item." }, { status: 404 });
    }

    const report = await portfolioReportService.buildReport();
    return NextResponse.json(serializeReport(report));
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 400 });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Không thể cập nhật portfolio.";
}
