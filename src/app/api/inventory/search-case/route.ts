import { NextRequest, NextResponse } from "next/server";
import { createServices } from "@/infrastructure/container";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q") ?? "";
    if (!query.trim()) {
      return NextResponse.json({ results: [] });
    }

    const { caseRepository, priceService } = createServices();
    const cases = await caseRepository.search(query);

    const results = await Promise.all(
      cases.slice(0, 10).map(async (caseItem) => {
        let price = 0;
        try {
          const snapshot = await priceService.getCurrentPrice(caseItem);
          price = snapshot?.price || 0;
        } catch {
          // ignore price errors
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
      }),
    );

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Lỗi tìm kiếm." },
      { status: 500 },
    );
  }
}
