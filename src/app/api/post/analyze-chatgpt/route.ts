import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { SteamMarketPriceProvider } from "@/infrastructure/price/steam-market-price-provider";
import { MongoPostAnalysisHistoryRepository } from "@/infrastructure/repositories/mongo-post-analysis-history-repository";
import { PostAnalysisService } from "@/services/post-analysis-service";
import { extractSteamUrl } from "@/services/parser/facebook-parser";
import { checkAuth } from "@/services/auth-service";
import { geminiRateLimiter } from "@/infrastructure/rate-limiter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { authorized } = await checkAuth();
    if (!authorized) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const ip = request.headers.get("x-forwarded-for") || (request as NextRequest & { ip?: string }).ip || "unknown-ip";
    const { allowed, retryAfter } = geminiRateLimiter.check(ip);
    if (!allowed) {
      return NextResponse.json(
        { message: `Quá nhiều yêu cầu. Vui lòng thử lại sau ${retryAfter} giây.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const body = await request.json();
    const text = String(body.text ?? "").trim();
    const chatGptJson = body.chatGptJson;

    if (!text) {
      return NextResponse.json(
        { message: "Nội dung bài viết trống." },
        { status: 400 },
      );
    }

    if (!chatGptJson || typeof chatGptJson !== "object") {
      return NextResponse.json(
        { message: "Dữ liệu JSON ChatGPT không hợp lệ." },
        { status: 400 },
      );
    }

    const historyRepository = new MongoPostAnalysisHistoryRepository();

    const analyzer = new PostAnalysisService(new SteamMarketPriceProvider());
    const analysis = await analyzer.analyzeWithExternalJson(text, chatGptJson);

    // Attach metadata fields from body or text
    analysis.author = typeof body.author === "string" ? body.author : undefined;
    analysis.postTime =
      typeof body.postTime === "string" ? body.postTime : undefined;
    analysis.postUrl =
      typeof body.postUrl === "string" ? body.postUrl : undefined;
    analysis.authorUrl =
      typeof body.authorUrl === "string" ? body.authorUrl : undefined;
    analysis.steamUrl =
      typeof body.steamUrl === "string"
        ? body.steamUrl
        : extractSteamUrl(text) || undefined;

    const fingerprint = createPostAnalysisFingerprint(text, chatGptJson);

    await historyRepository.save({
      fingerprint,
      text,
      analysis,
    });

    return NextResponse.json({
      ...analysis,
      cacheStatus: "miss",
    });
  } catch (error) {
    console.error("Error analyzing ChatGPT post:", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Không thể phân tích bài viết.",
      },
      { status: 500 },
    );
  }
}

function createPostAnalysisFingerprint(text: string, json: unknown): string {
  const normalizedText = text.replace(/\s+/g, " ").trim().toLowerCase();
  const jsonStr = JSON.stringify(json);
  return createHash("sha256")
    .update(normalizedText)
    .update("|chatgpt|")
    .update(jsonStr)
    .digest("hex");
}
