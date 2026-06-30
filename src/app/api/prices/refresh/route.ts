import { NextRequest, NextResponse } from "next/server";
import { createServices } from "@/infrastructure/container";
import { getPortfolioOwnerId } from "@/services/auth-service";
import { serializeReport } from "@/services/dto";
import { getErrorMessage } from "@/utils/error";
import { pricesRefreshRateLimiter } from "@/infrastructure/rate-limiter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || (request as NextRequest & { ip?: string }).ip || "unknown-ip";
    const { allowed, retryAfter } = await pricesRefreshRateLimiter.check(ip);
    if (!allowed) {
      return NextResponse.json(
        { message: `tooManyRequestsWithRetryAfter:retryAfter=${retryAfter}` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const { portfolioReportService } = createServices({
      ownerId: await getPortfolioOwnerId(),
    });
    const report = await portfolioReportService.buildReport({
      forceRefresh: true,
    });

    return NextResponse.json(serializeReport(report));
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "cannotRefreshPrices") },
      { status: 500 },
    );
  }
}
