import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry } from '@/infrastructure/gemini-retry';
import { extractPostImagesFromHtml } from '@/services/parser/facebook-image-extractor';
import { checkAuth, getCurrentUser, isAdminAccessAllowed } from '@/services/auth-service';
import { geminiRateLimiter } from '@/infrastructure/rate-limiter';

export const dynamic = 'force-dynamic';

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 10000;

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

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
    const rawHtml = String(body.html ?? '');

    if (!rawHtml.trim()) {
      return NextResponse.json({ message: 'htmlSourceEmpty' }, { status: 400 });
    }

    // Chuẩn hóa dấu gạch chéo escape thường gặp trong script block và JSON payload của Facebook
    const normalizedHtml = rawHtml.replace(/\\\//g, '/');

    // Trích xuất ảnh bài viết bằng bộ trích xuất ảnh Facebook CDN dùng chung
    const uniqueImages = extractPostImagesFromHtml(normalizedHtml);

    // Làm sạch HTML để trích xuất text bằng Gemini (bỏ script, style, SVG và comment để tiết kiệm token)
    const cleanedHtml = cleanHtmlForTextExtraction(normalizedHtml);

    // Gọi Gemini để lấy nội dung bài viết, tên tác giả và thời gian đăng
    const { text, author, postTime } = await extractTextAndAuthorWithGemini(cleanedHtml);

    return NextResponse.json({
      text: text || '',
      author: author || 'unknownPoster',
      postTime: postTime || 'unknownTime',
      imageUrls: uniqueImages,
    });
  } catch (error) {
    console.error('Error extracting post from HTML:', error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'cannotExtractFromHtml',
      },
      { status: 500 }
    );
  }
}

function cleanHtmlForTextExtraction(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 150000) // Giữ kích thước hợp lý để xử lý text
    .trim();
}

async function extractTextAndAuthorWithGemini(
  cleanedHtml: string
): Promise<{ text: string; author: string; postTime: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('geminiApiKeyNotConfigured');
  }

  try {
    const endpoint = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
    );
    endpoint.searchParams.set('key', apiKey);

    const response = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeoutMs: GEMINI_TIMEOUT_MS,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: buildExtractionPrompt(cleanedHtml) }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GeminiGenerateContentResponse;
    const output = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();

    if (!output) {
      return { text: '', author: '', postTime: '' };
    }

    const parsed = parseJsonObject(output) as {
      text?: string;
      author?: string;
      postTime?: string;
    } | null;

    let formattedTime = parsed?.postTime ?? '';
    if (formattedTime) {
      formattedTime = formatDateTimeString(formattedTime);
    }

    return {
      text: parsed?.text ?? '',
      author: parsed?.author ?? '',
      postTime: formattedTime,
    };
  } catch (error) {
    console.error('Gemini failed to extract text/author:', error);
    // Dự phòng: dùng regex đơn giản để trích xuất tác giả/text từ metadata
    return fallbackExtract(cleanedHtml);
  }
}

function buildExtractionPrompt(html: string): string {
  return `Analyze the raw Facebook post HTML and extract:
1. The post text (nội dung bài viết) detailing the cases/skins, rates, and prices. Ignore UI boilerplate.
2. The author's name (tên người đăng bài).
3. The post creation/published time (thời gian đăng bài) from metadata, schema, or attributes (like article:published_time, publish_time, creation_time, data-utime, datePublished).

Return strict JSON only:
{
  "text": "Vietnamese post content here",
  "author": "Author Name",
  "postTime": "Friendly formatted date-time or absolute datetime string"
}

HTML source snippet:
${html}`;
}

function parseJsonObject(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    const startIndex = value.indexOf('{');
    const endIndex = value.lastIndexOf('}');
    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      return null;
    }
    try {
      return JSON.parse(value.slice(startIndex, endIndex + 1));
    } catch {
      return null;
    }
  }
}

function fallbackExtract(html: string): {
  text: string;
  author: string;
  postTime: string;
} {
  // Dự phòng an toàn bằng meta tag
  const ogDescription =
    html.match(/<meta\s+property=["']og:description["']\s+content=["']([\s\S]*?)["']/i)?.[1] ??
    html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i)?.[1] ??
    '';

  const ogTitle =
    html.match(/<meta\s+property=["']og:title["']\s+content=["']([\s\S]*?)["']/i)?.[1] ??
    html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ??
    '';

  // Trích xuất tên tác giả từ title (ví dụ "Author Name - Posts | Facebook" hoặc "Author Name | Facebook")
  let author = 'unknownPoster';
  if (ogTitle) {
    const cleanTitle = ogTitle
      .replace(/\| Facebook/i, '')
      .replace(/- Posts/i, '')
      .trim();
    if (cleanTitle && cleanTitle !== 'Facebook') {
      author = cleanTitle;
    }
  }

  // Parse thời gian
  let postTime = '';
  const timeMatch =
    html.match(/<meta\s+property=["']article:published_time["']\s+content=["']([\s\S]*?)["']/i) ||
    html.match(/<meta\s+property=["']article:modified_time["']\s+content=["']([\s\S]*?)["']/i) ||
    html.match(/<meta\s+property=["']og:updated_time["']\s+content=["']([\s\S]*?)["']/i) ||
    html.match(/itemprop=["']datePublished["']\s+content=["']([\s\S]*?)["']/i);
  if (timeMatch && timeMatch[1]) {
    postTime = formatDateTimeString(timeMatch[1]);
  }

  if (!postTime) {
    const timeRegexes = [
      /\\?"publish_time\\?"\s*:\s*(\d{10})/i,
      /\\?"creation_time\\?"\s*:\s*(\d{10})/i,
      /\\?"created_time\\?"\s*:\s*(\d{10})/i,
      /\\?"post_creation_time\\?"\s*:\s*(\d{10})/i,
      /\\?"timestamp\\?"\s*:\s*(\d{10})/i,
      /data-utime=["'](\d{10})["']/i,
    ];
    for (const regex of timeRegexes) {
      const match = html.match(regex);
      if (match && match[1]) {
        const utime = parseInt(match[1], 10);
        postTime = formatDateTimeString(new Date(utime * 1000).toISOString());
        break;
      }
    }
  }

  return {
    text: ogDescription,
    author,
    postTime: postTime || 'unknownTime',
  };
}

function formatDateTimeString(value: string): string {
  try {
    const dateObj = new Date(value);
    if (isNaN(dateObj.getTime())) return value;
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(dateObj);
  } catch {
    return value;
  }
}
