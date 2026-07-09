import * as Ably from 'ably';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/services/auth-service';
import { getPortfolioRealtimeChannelName } from '@/services/realtime/portfolio-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TOKEN_TTL_MS = 60 * 60 * 1000;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ABLY_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ message: 'ablyNotConfigured' }, { status: 503 });
  }

  const ownerId = `google:${user.id}`;
  const channelName = getPortfolioRealtimeChannelName(ownerId);
  const ably = new Ably.Rest({ key: apiKey });
  const token = await ably.auth.requestToken({
    clientId: user.id,
    ttl: TOKEN_TTL_MS,
    capability: JSON.stringify({
      [channelName]: ['subscribe'],
    }),
  });

  return NextResponse.json(token);
}
