import { NextRequest, NextResponse } from "next/server";
import { SteamMarketPriceProvider } from "@/infrastructure/price/steam-market-price-provider";
import { PostAnalysisService } from "@/services/post-analysis-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = String(body.text ?? "");
    const analyzer = new PostAnalysisService(new SteamMarketPriceProvider());
    const analysis = await analyzer.analyze(text);

    return NextResponse.json(analysis);
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 400 });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Không thể phân tích bài viết.";
}
