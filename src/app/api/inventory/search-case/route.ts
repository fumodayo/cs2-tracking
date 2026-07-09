import { NextRequest, NextResponse } from 'next/server';
import { createServices } from '@/infrastructure/container';
import { searchCases } from '@/services/case-search';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q') ?? '';
    if (!query.trim()) {
      return NextResponse.json({ results: [] });
    }

    const cases = await searchCases(query);
    const { priceService } = createServices();

    const results = await Promise.all(
      cases.map(async (caseItem) => {
        let price = 0;
        try {
          const snapshot = await priceService.getCurrentPrice(caseItem);
          price = snapshot?.price || 0;
        } catch {
          // Bỏ qua lỗi giá
        }

        return {
          caseItem: {
            id: caseItem.id,
            name: caseItem.name,
            marketHashName: caseItem.marketHashName,
            imageUrl: caseItem.imageUrl ?? null,
            isActive: caseItem.isActive,
          },
          price,
        };
      })
    );

    const filteredResults = results.filter((r) => r.price > 0).slice(0, 10);

    return NextResponse.json({ results: filteredResults });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'searchFailed' },
      { status: 500 }
    );
  }
}
