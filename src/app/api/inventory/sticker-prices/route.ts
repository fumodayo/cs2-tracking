import { NextRequest, NextResponse } from "next/server";
import { createServices } from "@/infrastructure/container";
import { mapWithConcurrency } from "@/services/parser/utils";

const PRICE_CONCURRENCY = 3;
const MAX_ITEMS = 50;

type StickerPriceResult = {
  marketHashName: string;
  price: number;
  priceSource?: "steam-market";
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawNames: unknown[] = Array.isArray(body.marketHashNames)
      ? body.marketHashNames
      : [];
    const names: string[] = Array.from(
      new Set(
        rawNames
          .filter((name): name is string => typeof name === "string")
          .map((name: string) => name.trim())
          .filter(Boolean),
      ),
    ).slice(0, MAX_ITEMS);

    if (names.length === 0) {
      return NextResponse.json(
        { message: "missingMarketHashNames" },
        { status: 400 },
      );
    }

    const { caseRepository, priceService } = createServices();
    const results = await mapWithConcurrency(
      names,
      PRICE_CONCURRENCY,
      async (marketHashName): Promise<StickerPriceResult> => {
        try {
          const caseItem =
            await caseRepository.findByMarketHashName(marketHashName);
          const item = caseItem ?? {
            id: `ext_${marketHashName}`,
            name: marketHashName,
            marketHashName,
            isActive: false,
          };
          const priceSnapshot = await priceService.getCurrentPrice(item, {
            preferFallback: true,
          });
          const price = priceSnapshot?.price || 0;
          return {
            marketHashName,
            price,
            priceSource: price > 0 ? "steam-market" : undefined,
          };
        } catch {
          return { marketHashName, price: 0 };
        }
      },
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Sticker price error:", error);
    return NextResponse.json(
      { message: "steamMarketGeneric" },
      { status: 500 },
    );
  }
}
