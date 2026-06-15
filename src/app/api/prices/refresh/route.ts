import { NextResponse } from "next/server";
import { createServices } from "@/infrastructure/container";
import { getPortfolioOwnerId } from "@/services/auth-service";
import { serializeReport } from "@/services/dto";
import { getErrorMessage } from "@/utils/error";

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
      { message: getErrorMessage(error, "Không thể refresh giá.") },
      { status: 500 },
    );
  }
}
