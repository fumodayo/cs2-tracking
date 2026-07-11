import { NextRequest, NextResponse } from 'next/server';
import { createServices } from '@/infrastructure/container';
import { getPortfolioOwnerId } from '@/services/auth-service';
import { serializeReport } from '@/services/dto';
import { getErrorMessage } from '@/utils/error';
import { pricesRefreshRateLimiter } from '@/infrastructure/rate-limiter';
import { publishPortfolioChanged } from '@/services/realtime/portfolio-events';
import { setCachedPortfolioReport } from '@/services/portfolio-report-cache';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for') ||
      (request as NextRequest & { ip?: string }).ip ||
      'unknown-ip';
    const { allowed, retryAfter } = await pricesRefreshRateLimiter.check(ip);
    if (!allowed) {
      return NextResponse.json(
        { message: `tooManyRequestsWithRetryAfter:retryAfter=${retryAfter}` },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const ownerId = await getPortfolioOwnerId();
    const { portfolioReportService } = createServices({ ownerId });
    const report = await portfolioReportService.buildReport({
      forceRefresh: true,
    });
    const serializedReport = serializeReport(report);
    setCachedPortfolioReport(ownerId, serializedReport);
    await publishPortfolioChanged(ownerId, 'prices_refreshed');

    return NextResponse.json(serializedReport);
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, 'cannotRefreshPrices') },
      { status: 500 }
    );
  }
}
