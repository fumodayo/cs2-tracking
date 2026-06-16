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

    const trimmedQuery = query.trim();
    if (trimmedQuery.length >= 3) {
      const hasExactMatch = cases.some(
        (c) =>
          c.marketHashName.toLowerCase() === trimmedQuery.toLowerCase() ||
          c.name.toLowerCase() === trimmedQuery.toLowerCase(),
      );
      if (!hasExactMatch) {
        const { getSteamCaseImageUrl } =
          await import("@/infrastructure/cases/steam-case-image-provider");
        const imageUrl = await getSteamCaseImageUrl(trimmedQuery);

        if (imageUrl) {
          cases.unshift({
            id: `ext_${trimmedQuery}`,
            name: trimmedQuery,
            marketHashName: trimmedQuery,
            imageUrl: imageUrl,
            isActive: true,
          });
        }
      }
    }

    const results = await Promise.all(
      cases.map(async (caseItem) => {
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

    const filteredResults = results.filter((r) => r.price > 0).slice(0, 10);

    return NextResponse.json({ results: filteredResults });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Lỗi tìm kiếm." },
      { status: 500 },
    );
  }
}
