import { NextRequest, NextResponse } from 'next/server';
import { USER_AGENTS } from '@/utils/api-client';
import { isSafeUrl } from '@/utils/url';
import { SteamMarketPriceProvider } from '@/infrastructure/price/steam-market-price-provider';
import { MongoPostAnalysisHistoryRepository } from '@/infrastructure/repositories/mongo-post-analysis-history-repository';
import { PostAnalysisService } from '@/services/post-analysis-service';
import { checkAuth, getCurrentUser, isAdminAccessAllowed } from '@/services/auth-service';
import { geminiRateLimiter } from '@/infrastructure/rate-limiter';
import { createPostAnalysisFingerprint } from '@/services/post-analysis-fingerprint';

export const dynamic = 'force-dynamic';

const MAX_REMOTE_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REMOTE_IMAGES = 5;
const ALLOWED_REMOTE_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
]);

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

    const body = (await request.json()) as Record<string, unknown>;
    const text = String(body.text ?? '').trim();
    const imageUrls = Array.isArray(body.imageUrls)
      ? body.imageUrls
          .filter((value: unknown): value is string => typeof value === 'string')
          .slice(0, MAX_REMOTE_IMAGES)
      : [];
    const force = body.force === true;
    const postUrl = typeof body.postUrl === 'string' ? body.postUrl.trim() : undefined;

    if (!text) {
      return NextResponse.json({ message: 'postContentEmpty' }, { status: 400 });
    }

    const historyRepository = new MongoPostAnalysisHistoryRepository();

    // Kiểm tra theo postUrl trước khi tải ảnh hoặc xử lý nặng
    if (!force && postUrl) {
      const cachedByUrl = await historyRepository.findByPostUrl(postUrl);
      if (cachedByUrl) {
        await historyRepository.touch(cachedByUrl.id);
        return NextResponse.json({
          ...cachedByUrl.analysis,
          imageCloudinaryUrl: cachedByUrl.imageCloudinaryUrl,
          author: cachedByUrl.analysis.author ?? body.author ?? undefined,
          postTime: cachedByUrl.analysis.postTime ?? body.postTime ?? undefined,
          postUrl: cachedByUrl.analysis.postUrl ?? postUrl,
          authorUrl: cachedByUrl.analysis.authorUrl ?? body.authorUrl ?? undefined,
          steamUrl: cachedByUrl.analysis.steamUrl ?? body.steamUrl ?? undefined,
          cacheStatus: 'hit',
        });
      }
    }

    const imageInputs: Array<{
      data: string;
      mimeType: string;
      fileName: string;
    }> = [];

    // Nếu có chọn URL ảnh, tải song song và chuyển sang base64
    if (imageUrls.length > 0) {
      await Promise.all(
        imageUrls.map(async (imageUrl: string, idx: number) => {
          try {
            if (!isSafeUrl(imageUrl)) {
              throw new Error('URL is not in the allowed safe domains list (SSRF Protection)');
            }

            const imageRes = await fetch(imageUrl, {
              headers: {
                'User-Agent': USER_AGENTS.steamBrowser,
              },
            });

            if (!imageRes.ok) {
              throw new Error(`HTTP status ${imageRes.status}`);
            }

            const mimeType =
              imageRes.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ||
              'application/octet-stream';
            if (!ALLOWED_REMOTE_IMAGE_TYPES.has(mimeType)) {
              throw new Error(`Unsupported content-type ${mimeType}`);
            }

            const contentLength = Number(imageRes.headers.get('content-length') || '0');
            if (contentLength > MAX_REMOTE_IMAGE_BYTES) {
              throw new Error('Remote image too large');
            }

            const arrayBuffer = await imageRes.arrayBuffer();
            if (arrayBuffer.byteLength > MAX_REMOTE_IMAGE_BYTES) {
              throw new Error('Remote image too large');
            }

            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString('base64');

            imageInputs.push({
              data: base64,
              mimeType,
              fileName: `facebook_post_image_${idx}.jpg`,
            });
          } catch (fetchError) {
            console.error(`Failed to download image ${imageUrl} from Facebook CDN:`, fetchError);
          }
        })
      );
    }

    const fingerprint = createPostAnalysisFingerprint(text, imageInputs);
    const cachedHistoryItem = !force
      ? await historyRepository.findByFingerprint(fingerprint)
      : null;

    if (cachedHistoryItem) {
      await historyRepository.touch(cachedHistoryItem.id);

      // Nâng cấp động: upload ảnh lên Cloudinary nếu trước đó chưa làm
      if (!cachedHistoryItem.imageCloudinaryUrl && imageInputs.length > 0) {
        try {
          const { uploadImageToCloudinary } = await import('@/infrastructure/cloudinary');
          const imageCloudinaryUrl = await uploadImageToCloudinary(
            imageInputs[0].data,
            imageInputs[0].mimeType
          );

          if (imageCloudinaryUrl) {
            cachedHistoryItem.imageCloudinaryUrl = imageCloudinaryUrl;
            cachedHistoryItem.analysis.imageCloudinaryUrl = imageCloudinaryUrl;

            await historyRepository.save({
              fingerprint,
              text,
              imageFileName: imageInputs[0].fileName,
              imageCloudinaryUrl,
              analysis: {
                ...cachedHistoryItem.analysis,
                imageCloudinaryUrl,
              },
            });
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
    if (imageInputs.length > 0) {
      try {
        const { uploadImageToCloudinary } = await import('@/infrastructure/cloudinary');
        imageCloudinaryUrl = await uploadImageToCloudinary(
          imageInputs[0].data,
          imageInputs[0].mimeType
        );
      } catch (uploadError) {
        console.error('Failed to upload image to Cloudinary:', uploadError);
      }
    }

    const analyzer = new PostAnalysisService(new SteamMarketPriceProvider());
    const analysis = await analyzer.analyze(text, imageInputs);

    // Gắn các trường metadata từ body hoặc text
    analysis.author = typeof body.author === 'string' ? body.author : undefined;
    analysis.postTime = typeof body.postTime === 'string' ? body.postTime : undefined;
    analysis.postUrl = typeof body.postUrl === 'string' ? body.postUrl : undefined;
    analysis.authorUrl = typeof body.authorUrl === 'string' ? body.authorUrl : undefined;
    analysis.steamUrl =
      typeof body.steamUrl === 'string' ? body.steamUrl : extractSteamUrl(text) || undefined;

    await historyRepository.save({
      fingerprint,
      text,
      imageFileName: imageInputs.length > 0 ? imageInputs[0].fileName : undefined,
      imageCloudinaryUrl,
      analysis: {
        ...analysis,
        imageCloudinaryUrl,
      },
    });

    return NextResponse.json({
      ...analysis,
      imageCloudinaryUrl,
      cacheStatus: 'miss',
    });
  } catch (error) {
    console.error('Error analyzing HTML post:', error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'cannotAnalyzePost',
      },
      { status: 500 }
    );
  }
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
