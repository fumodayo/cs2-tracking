import { NextRequest, NextResponse } from 'next/server';
import { SteamMarketPriceProvider } from '@/infrastructure/price/steam-market-price-provider';
import { MongoPostAnalysisHistoryRepository } from '@/infrastructure/repositories/mongo-post-analysis-history-repository';
import { PostAnalysisService } from '@/services/post-analysis-service';
import { extractSteamUrl } from '@/services/parser/facebook-parser';
import { checkAuth, getCurrentUser, isAdminAccessAllowed } from '@/services/auth-service';
import { geminiRateLimiter } from '@/infrastructure/rate-limiter';
import { createChatGptPostAnalysisFingerprint as createPostAnalysisFingerprint } from '@/services/post-analysis-fingerprint';

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
    const text = String(body.text ?? '').trim();
    const chatGptJson = body.chatGptJson;

    if (!text) {
      return NextResponse.json({ message: 'postContentEmpty' }, { status: 400 });
    }

    if (!chatGptJson || typeof chatGptJson !== 'object') {
      return NextResponse.json({ message: 'invalidChatGptJson' }, { status: 400 });
    }

    const historyRepository = new MongoPostAnalysisHistoryRepository();

    const analyzer = new PostAnalysisService(new SteamMarketPriceProvider());
    const analysis = await analyzer.analyzeWithExternalJson(text, chatGptJson);

    // Gắn các trường metadata từ body hoặc text
    analysis.author = typeof body.author === 'string' ? body.author : undefined;
    analysis.postTime = typeof body.postTime === 'string' ? body.postTime : undefined;
    analysis.postUrl = typeof body.postUrl === 'string' ? body.postUrl : undefined;
    analysis.authorUrl = typeof body.authorUrl === 'string' ? body.authorUrl : undefined;
    analysis.steamUrl =
      typeof body.steamUrl === 'string' ? body.steamUrl : extractSteamUrl(text) || undefined;

    const fingerprint = createPostAnalysisFingerprint(text, chatGptJson);

    await historyRepository.save({
      fingerprint,
      text,
      analysis,
    });

    return NextResponse.json({
      ...analysis,
      cacheStatus: 'miss',
    });
  } catch (error) {
    console.error('Error analyzing ChatGPT post:', error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'cannotAnalyzePost',
      },
      { status: 500 }
    );
  }
}
