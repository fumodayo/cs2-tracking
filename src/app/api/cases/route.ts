import { NextRequest, NextResponse } from "next/server";
import { createServices } from "@/infrastructure/container";
import { getErrorMessage } from "@/utils/error";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("search") ?? "";
    const { caseRepository } = createServices();
    const cases = await caseRepository.search(query);

    const trimmedQuery = query.trim();
    if (trimmedQuery.length >= 3) {
      const hasExactMatch = cases.some(
        (c) =>
          c.marketHashName.toLowerCase() === trimmedQuery.toLowerCase() ||
          c.name.toLowerCase() === trimmedQuery.toLowerCase(),
      );
      if (!hasExactMatch) {
        // Dynamically import to avoid circular dependencies in some setups
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

    return NextResponse.json({ cases });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "Không thể tải danh sách case.") },
      { status: 500 },
    );
  }
}
