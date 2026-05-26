import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { SteamMarketPriceProvider } from "@/infrastructure/price/steam-market-price-provider";
import { MongoPostAnalysisHistoryRepository } from "@/infrastructure/repositories/mongo-post-analysis-history-repository";
import { PostAnalysisService } from "@/services/post-analysis-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = String(body.text ?? "");
    const image = normalizeImageInput(body.image);
    const fingerprint = createPostAnalysisFingerprint(text, image);
    const historyRepository = new MongoPostAnalysisHistoryRepository();
    const cachedHistoryItem = await historyRepository.findByFingerprint(fingerprint);
    if (cachedHistoryItem) {
      await historyRepository.touch(cachedHistoryItem.id);
      return NextResponse.json({
        ...cachedHistoryItem.analysis,
        cacheStatus: "hit",
      });
    }

    const analyzer = new PostAnalysisService(new SteamMarketPriceProvider());
    const analysis = await analyzer.analyze(text, image);
    await historyRepository.save({
      fingerprint,
      text,
      imageFileName: image?.fileName,
      analysis,
    });

    return NextResponse.json({
      ...analysis,
      cacheStatus: "miss",
    });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}

function normalizeImageInput(value: unknown): { data: string; mimeType: string; fileName?: string } | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const rawData = typeof value.data === "string" ? value.data.trim() : "";
  const mimeType = typeof value.mimeType === "string" ? value.mimeType.trim().toLowerCase() : "";
  if (!rawData && !mimeType) {
    return undefined;
  }

  if (!/^image\/(?:png|jpe?g|webp)$/.test(mimeType)) {
    throw new Error("Ảnh inventory phải là PNG, JPG hoặc WebP.");
  }

  const data = rawData.includes(",") ? rawData.split(",").pop() ?? "" : rawData;
  if (!/^[a-z0-9+/=\r\n]+$/i.test(data) || data.length === 0) {
    throw new Error("Dữ liệu ảnh không hợp lệ.");
  }

  if (data.length > 8_000_000) {
    throw new Error("Ảnh quá lớn. Hãy dùng ảnh dưới khoảng 6MB.");
  }

  return {
    data,
    mimeType,
    fileName: typeof value.fileName === "string" && value.fileName.trim() ? value.fileName.trim().slice(0, 180) : undefined,
  };
}

function createPostAnalysisFingerprint(
  text: string,
  image: { data: string; mimeType: string } | undefined,
): string {
  const normalizedText = text.replace(/\s+/g, " ").trim().toLowerCase();
  const imageHash = image ? createHash("sha256").update(image.mimeType).update(":").update(image.data).digest("hex") : "no-image";
  return createHash("sha256").update(normalizedText).update("|").update(imageHash).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Không thể phân tích bài viết.";
}

function getErrorStatus(error: unknown): number {
  if (!isRecord(error) || typeof error.statusCode !== "number") {
    return isClientError(error) ? 400 : 500;
  }

  return error.statusCode >= 400 && error.statusCode <= 599 ? error.statusCode : 400;
}

function isClientError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.startsWith("Ảnh ") ||
    error.message.startsWith("Dữ liệu ảnh ") ||
    error.message.startsWith("Không tìm thấy case ") ||
    error.message.startsWith("Không nhận diện được case ")
  );
}
