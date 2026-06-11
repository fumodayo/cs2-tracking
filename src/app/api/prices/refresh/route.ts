import { NextResponse } from "next/server";
import { createServices } from "@/infrastructure/container";
import { getPortfolioOwnerId } from "@/services/auth-service";
import { serializeReport } from "@/services/dto";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { portfolioReportService } = createServices({
      ownerId: await getPortfolioOwnerId(),
    });
    const report = await portfolioReportService.buildReport({
      forceRefresh: true,
    });

    return NextResponse.json(serializeReport(report));
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Không thể refresh giá.";
}
