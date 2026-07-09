import { NextRequest, NextResponse } from 'next/server';
import { createServices } from '@/infrastructure/container';
import { mapWithConcurrency } from '@/services/parser/utils';
import { retryPriceRateLimiter } from '@/infrastructure/rate-limiter';

const RETRY_CONCURRENCY = 3;

type RetryResult = {
  marketHashName: string;
  price: number;
  priceSource?: 'steam-market';
};

/**
 *
 *
 * POST /api/inventory/retry-price
 * Body: { marketHashNames: string[] }
 *
 * Thử lấy lại giá Steam Market theo lô cho nhiều vật phẩm với giới hạn song song.
 * Trả về { results: RetryResult[] } — mỗi vật phẩm đầu vào có một kết quả.
 *
 *
 */
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for') ||
      (request as NextRequest & { ip?: string }).ip ||
      'unknown-ip';
    const { allowed, retryAfter } = await retryPriceRateLimiter.check(ip);
    if (!allowed) {
      return NextResponse.json(
        { message: 'tooManyRequests', details: { retryAfter } },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const body = await request.json();
    const { marketHashNames } = body;

    if (!Array.isArray(marketHashNames) || marketHashNames.length === 0) {
      return NextResponse.json({ message: 'missingMarketHashNames' }, { status: 400 });
    }

    // Giới hạn kích thước batch để tránh lạm dụng
    const names: string[] = marketHashNames.slice(0, 200);

    const { caseRepository, priceService } = createServices();

    const results = await mapWithConcurrency(
      names,
      RETRY_CONCURRENCY,
      async (marketHashName): Promise<RetryResult> => {
        try {
          const caseItem = await caseRepository.findByMarketHashName(marketHashName);
          const item = caseItem ?? {
            id: `ext_${marketHashName}`,
            name: marketHashName,
            marketHashName,
            isActive: false,
          };

          const priceSnapshot = await priceService.getCurrentPrice(item, {
            forceRefresh: true,
          });
          const price = priceSnapshot?.price || 0;

          return {
            marketHashName,
            price,
            priceSource: price > 0 ? 'steam-market' : undefined,
          };
        } catch {
          return { marketHashName, price: 0 };
        }
      }
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Retry price error:', error);
    return NextResponse.json({ message: 'steamMarketGeneric' }, { status: 500 });
  }
}
