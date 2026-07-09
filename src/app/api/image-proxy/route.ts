import { NextRequest, NextResponse } from 'next/server';
import { isSafeUrl } from '@/utils/url';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_PROXY_TIMEOUT_MS = 8_000;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return new NextResponse('Missing url parameter', { status: 400 });
    }

    if (!isSafeUrl(imageUrl)) {
      return new NextResponse('Invalid or unsafe URL', { status: 400 });
    }

    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(IMAGE_PROXY_TIMEOUT_MS),
      next: { revalidate: 60 * 60 * 24 * 7 },
    });

    if (!response.ok) {
      return new NextResponse('Failed to fetch image', { status: response.status });
    }

    const contentType = (response.headers.get('content-type') || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return new NextResponse('Unsupported image type', { status: 415 });
    }

    const contentLength = Number(response.headers.get('content-length') || '0');
    if (contentLength > MAX_IMAGE_BYTES) {
      return new NextResponse('Image too large', { status: 413 });
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return new NextResponse('Image too large', { status: 413 });
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=604800, immutable',
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
