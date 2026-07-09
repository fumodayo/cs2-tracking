import { NextRequest, NextResponse } from 'next/server';
import { SteamMarketPriceProvider } from '@/infrastructure/price/steam-market-price-provider';
import { MongoPostAnalysisHistoryRepository } from '@/infrastructure/repositories/mongo-post-analysis-history-repository';
import { PostAnalysisService } from '@/services/post-analysis-service';
import { publishPostAnalysisHistoryChanged } from '@/services/realtime/post-analysis-events';
import { getErrorMessage } from '@/utils/error';
import { checkAuth, getCurrentUser, isAdminAccessAllowed } from '@/services/auth-service';
import { geminiRateLimiter } from '@/infrastructure/rate-limiter';
import {
  createPostAnalysisFingerprint,
  normalizeImageInput,
} from '@/services/post-analysis-fingerprint';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { authorized } = await checkAuth();
    if (!authorized) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = await getCurrentUser();
    const isAdmin = isAdminAccessAllowed(user);
    if (!isAdmin) {
      return NextResponse.json({ message: 'adminOnlyAction' }, { status: 403 });
    }

    const ip =
      request.headers.get('x-forwarded-for') ||
      (request as NextRequest & { ip?: string }).ip ||
      'unknown-ip';
    const { allowed, retryAfter } = await geminiRateLimiter.check(ip);
    if (!allowed) {
      return NextResponse.json(
        { message: `tooManyRequestsWithRetryAfter:retryAfter=${retryAfter}` },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const body = await request.json();
    const text = String(body.text ?? '');
    const image = normalizeImageInput(body.image);
    const force = body.force === true;
    const fingerprint = createPostAnalysisFingerprint(text, image);
    const historyRepository = new MongoPostAnalysisHistoryRepository();
    const cachedHistoryItem = !force
      ? await historyRepository.findByFingerprint(fingerprint)
      : null;
    if (cachedHistoryItem) {
      const touchedHistoryItem = await historyRepository.touch(cachedHistoryItem.id);
      if (touchedHistoryItem) {
        await publishPostAnalysisHistoryChanged('touched', { id: touchedHistoryItem.id });
      }

      // Nâng cấp động: nếu item trong cache được lưu trước khi tích hợp Cloudinary,
      // hãy upload ảnh request hiện tại và cập nhật database.
      if (!cachedHistoryItem.imageCloudinaryUrl && image) {
        try {
          const { uploadImageToCloudinary } = await import('@/infrastructure/cloudinary');
          const imageCloudinaryUrl = await uploadImageToCloudinary(image.data, image.mimeType);

          if (imageCloudinaryUrl) {
            cachedHistoryItem.imageCloudinaryUrl = imageCloudinaryUrl;
            cachedHistoryItem.analysis.imageCloudinaryUrl = imageCloudinaryUrl;

            const savedHistoryItem = await historyRepository.save({
              fingerprint,
              text,
              imageFileName: image.fileName,
              imageCloudinaryUrl,
              analysis: {
                ...cachedHistoryItem.analysis,
                imageCloudinaryUrl,
              },
            });
            await publishPostAnalysisHistoryChanged('saved', { id: savedHistoryItem.id });
          }
        } catch (uploadError) {
          console.error('Failed to dynamically upload cached image to Cloudinary:', uploadError);
        }
      }

      return NextResponse.json({
        ...cachedHistoryItem.analysis,
        imageCloudinaryUrl: cachedHistoryItem.imageCloudinaryUrl,
        author: cachedHistoryItem.analysis.author ?? body.author ?? undefined,
        postTime: cachedHistoryItem.analysis.postTime ?? body.postTime ?? undefined,
        postUrl: cachedHistoryItem.analysis.postUrl ?? body.postUrl ?? undefined,
        authorUrl: cachedHistoryItem.analysis.authorUrl ?? body.authorUrl ?? undefined,
        steamUrl: cachedHistoryItem.analysis.steamUrl ?? body.steamUrl ?? undefined,
        cacheStatus: 'hit',
      });
    }

    let imageCloudinaryUrl: string | undefined = undefined;
    if (image) {
      try {
        const { uploadImageToCloudinary } = await import('@/infrastructure/cloudinary');
        imageCloudinaryUrl = await uploadImageToCloudinary(image.data, image.mimeType);
      } catch (uploadError) {
        console.error('Failed to upload image to Cloudinary:', uploadError);
      }
    }

    const analyzer = new PostAnalysisService(new SteamMarketPriceProvider());
    const analysis = await analyzer.analyze(text, image);

    // Gắn các trường metadata từ body hoặc text
    analysis.author = typeof body.author === 'string' ? body.author : undefined;
    analysis.postTime = typeof body.postTime === 'string' ? body.postTime : undefined;
    analysis.postUrl = typeof body.postUrl === 'string' ? body.postUrl : undefined;
    analysis.authorUrl = typeof body.authorUrl === 'string' ? body.authorUrl : undefined;
    analysis.steamUrl =
      typeof body.steamUrl === 'string' ? body.steamUrl : extractSteamUrl(text) || undefined;

    const savedHistoryItem = await historyRepository.save({
      fingerprint,
      text,
      imageFileName: image?.fileName,
      imageCloudinaryUrl,
      analysis: {
        ...analysis,
        imageCloudinaryUrl,
      },
    });
    await publishPostAnalysisHistoryChanged('saved', { id: savedHistoryItem.id });

    return NextResponse.json({
      ...analysis,
      imageCloudinaryUrl,
      cacheStatus: 'miss',
    });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, 'cannotAnalyzePost') },
      { status: getErrorStatus(error) }
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getErrorStatus(error: unknown): number {
  if (!isRecord(error) || typeof error.statusCode !== 'number') {
    return isClientError(error) ? 400 : 500;
  }

  return error.statusCode >= 400 && error.statusCode <= 599 ? error.statusCode : 400;
}

const CLIENT_ERROR_KEYS = [
  'invalidImageFormat',
  'invalidImageData',
  'imageTooLarge',
  'noCaseDetectedInPostOrImages',
  'noCaseDetectedInPost',
  'invalidChatGptJson',
  'chatGptJsonEmpty',
  'geminiApiKeyNotConfiguredImage',
  'geminiNoResponse',
  'geminiTimeout',
  'geminiConnectionError',
  'geminiQuotaExceeded',
  'geminiInvalidApiKey',
  'geminiPayloadRejected',
  'geminiPayloadRejectedWithReason',
  'geminiRecognitionFailed',
  'geminiRecognitionFailedWithReason',
];

function isClientError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errMsg = error.message;
  return (
    CLIENT_ERROR_KEYS.includes(errMsg) ||
    errMsg.startsWith('geminiQuotaExceeded:') ||
    errMsg.startsWith('geminiPayloadRejectedWithReason:') ||
    errMsg.startsWith('geminiRecognitionFailedWithReason:')
  );
}

function extractSteamUrl(text: string): string | null {
  const fullLinkMatch = text.match(
    /https?:\/\/steamcommunity\.com\/(?:id|profiles)\/[a-zA-Z0-9_-]+/i
  );
  if (fullLinkMatch) {
    const base = fullLinkMatch[0];
    return base.endsWith('/inventory') || base.endsWith('/inventory/')
      ? base
      : `${base.replace(/\/$/, '')}/inventory/`;
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
