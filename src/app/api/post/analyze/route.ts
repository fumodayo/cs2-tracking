import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { SteamMarketPriceProvider } from "@/infrastructure/price/steam-market-price-provider";
import { MongoPostAnalysisHistoryRepository } from "@/infrastructure/repositories/mongo-post-analysis-history-repository";
import { PostAnalysisService } from "@/services/post-analysis-service";
import { getErrorMessage } from "@/utils/error";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = String(body.text ?? "");
    const image = normalizeImageInput(body.image);
    const force = body.force === true;
    const fingerprint = createPostAnalysisFingerprint(text, image);
    const historyRepository = new MongoPostAnalysisHistoryRepository();
    const cachedHistoryItem = !force
      ? await historyRepository.findByFingerprint(fingerprint)
      : null;
    if (cachedHistoryItem) {
      await historyRepository.touch(cachedHistoryItem.id);

      // Dynamic Upgrade: If the cached item was saved before Cloudinary was integrated,
      // upload the current request image now and update the database.
      if (!cachedHistoryItem.imageCloudinaryUrl && image) {
        try {
          const { uploadImageToCloudinary } =
            await import("@/infrastructure/cloudinary");
          const imageCloudinaryUrl = await uploadImageToCloudinary(
            image.data,
            image.mimeType,
          );

          if (imageCloudinaryUrl) {
            cachedHistoryItem.imageCloudinaryUrl = imageCloudinaryUrl;
            cachedHistoryItem.analysis.imageCloudinaryUrl = imageCloudinaryUrl;

            await historyRepository.save({
              fingerprint,
              text,
              imageFileName: image.fileName,
              imageCloudinaryUrl,
              analysis: {
                ...cachedHistoryItem.analysis,
                imageCloudinaryUrl,
              },
            });
          }
        } catch (uploadError) {
          console.error(
            "Failed to dynamically upload cached image to Cloudinary:",
            uploadError,
          );
        }
      }

      return NextResponse.json({
        ...cachedHistoryItem.analysis,
        imageCloudinaryUrl: cachedHistoryItem.imageCloudinaryUrl,
        author: cachedHistoryItem.analysis.author ?? body.author ?? undefined,
        postTime:
          cachedHistoryItem.analysis.postTime ?? body.postTime ?? undefined,
        postUrl:
          cachedHistoryItem.analysis.postUrl ?? body.postUrl ?? undefined,
        authorUrl:
          cachedHistoryItem.analysis.authorUrl ?? body.authorUrl ?? undefined,
        steamUrl:
          cachedHistoryItem.analysis.steamUrl ?? body.steamUrl ?? undefined,
        cacheStatus: "hit",
      });
    }

    let imageCloudinaryUrl: string | undefined = undefined;
    if (image) {
      try {
        const { uploadImageToCloudinary } =
          await import("@/infrastructure/cloudinary");
        imageCloudinaryUrl = await uploadImageToCloudinary(
          image.data,
          image.mimeType,
        );
      } catch (uploadError) {
        console.error("Failed to upload image to Cloudinary:", uploadError);
      }
    }

    const analyzer = new PostAnalysisService(new SteamMarketPriceProvider());
    const analysis = await analyzer.analyze(text, image);

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

    await historyRepository.save({
      fingerprint,
      text,
      imageFileName: image?.fileName,
      imageCloudinaryUrl,
      analysis: {
        ...analysis,
        imageCloudinaryUrl,
      },
    });

    return NextResponse.json({
      ...analysis,
      imageCloudinaryUrl,
      cacheStatus: "miss",
    });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "Không thể phân tích bài viết.") },
      { status: getErrorStatus(error) },
    );
  }
}

function normalizeImageInput(
  value: unknown,
): { data: string; mimeType: string; fileName?: string } | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const rawData = typeof value.data === "string" ? value.data.trim() : "";
  const mimeType =
    typeof value.mimeType === "string"
      ? value.mimeType.trim().toLowerCase()
      : "";
  if (!rawData && !mimeType) {
    return undefined;
  }

  if (!/^image\/(?:png|jpe?g|webp)$/.test(mimeType)) {
    throw new Error("Ảnh inventory phải là PNG, JPG hoặc WebP.");
  }

  const data = rawData.includes(",")
    ? (rawData.split(",").pop() ?? "")
    : rawData;
  if (!/^[a-z0-9+/=\r\n]+$/i.test(data) || data.length === 0) {
    throw new Error("Dữ liệu ảnh không hợp lệ.");
  }

  if (data.length > 8_000_000) {
    throw new Error("Ảnh quá lớn. Hãy dùng ảnh dưới khoảng 6MB.");
  }

  return {
    data,
    mimeType,
    fileName:
      typeof value.fileName === "string" && value.fileName.trim()
        ? value.fileName.trim().slice(0, 180)
        : undefined,
  };
}

function createPostAnalysisFingerprint(
  text: string,
  image: { data: string; mimeType: string } | undefined,
): string {
  const normalizedText = text.replace(/\s+/g, " ").trim().toLowerCase();
  const imageHash = image
    ? createHash("sha256")
        .update(image.mimeType)
        .update(":")
        .update(image.data)
        .digest("hex")
    : "no-image";
  return createHash("sha256")
    .update(normalizedText)
    .update("|")
    .update(imageHash)
    .digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}



function getErrorStatus(error: unknown): number {
  if (!isRecord(error) || typeof error.statusCode !== "number") {
    return isClientError(error) ? 400 : 500;
  }

  return error.statusCode >= 400 && error.statusCode <= 599
    ? error.statusCode
    : 400;
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

function extractSteamUrl(text: string): string | null {
  const fullLinkMatch = text.match(
    /https?:\/\/steamcommunity\.com\/(?:id|profiles)\/[a-zA-Z0-9_-]+/i,
  );
  if (fullLinkMatch) {
    const base = fullLinkMatch[0];
    return base.endsWith("/inventory") || base.endsWith("/inventory/")
      ? base
      : `${base.replace(/\/$/, "")}/inventory/`;
  }

  const idMatch = text.match(/(?:\/id\/|id\/)([a-zA-Z0-9_-]+)/i);
  if (idMatch && idMatch[1]) {
    return `https://steamcommunity.com/id/${idMatch[1]}/inventory/`;
  }

  const profileMatch = text.match(/(?:\/profiles\/|profiles\/)([0-9]+)/i);
  if (profileMatch && profileMatch[1]) {
    return `https://steamcommunity.com/profiles/${profileMatch[1]}/inventory/`;
  }

  return null;
}
