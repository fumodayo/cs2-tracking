import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const method = request.method;

  // Only apply CSRF protection to state-changing API requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const host = request.headers.get('host') || request.nextUrl.host;

    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host) {
          return new NextResponse(
            JSON.stringify({ message: 'CSRF check failed: Invalid Origin' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch {
        return new NextResponse(
          JSON.stringify({ message: 'CSRF check failed: Malformed Origin' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.host !== host) {
          return new NextResponse(
            JSON.stringify({ message: 'CSRF check failed: Invalid Referer' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch {
        return new NextResponse(
          JSON.stringify({ message: 'CSRF check failed: Malformed Referer' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Require either Origin or Referer for state-changing API endpoints
      return new NextResponse(
        JSON.stringify({ message: 'CSRF check failed: Missing Origin/Referer headers' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
