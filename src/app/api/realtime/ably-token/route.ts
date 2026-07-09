import * as Ably from 'ably';
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/infrastructure/db/mongo-client';
import { getCurrentUser, isAdminUser } from '@/services/auth-service';
import { getBugReportsRealtimeChannelName } from '@/services/realtime/bug-report-events';
import { getPortfolioRealtimeChannelName } from '@/services/realtime/portfolio-events';
import { getPostAnalysisHistoryRealtimeChannelName } from '@/services/realtime/post-analysis-events';
import { getScanRealtimeChannelName } from '@/services/realtime/scan-events';
import { getUserBuffPricesRealtimeChannelName } from '@/services/realtime/user-buff-price-events';
import { getUserSettingsRealtimeChannelName } from '@/services/realtime/user-settings-events';
import { getInMemoryJob } from '@/services/scan-job-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TOKEN_TTL_MS = 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ABLY_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ message: 'ablyNotConfigured' }, { status: 503 });
  }

  const ownerId = `google:${user.id}`;
  const portfolioChannelName = getPortfolioRealtimeChannelName(ownerId);
  const scanJobId = request.nextUrl.searchParams.get('scanJobId')?.trim();
  const wantsAdminBugReports = request.nextUrl.searchParams.get('adminBugReports') === '1';
  const wantsAdminPostAnalysis = request.nextUrl.searchParams.get('adminPostAnalysis') === '1';
  const wantsUserBuffPrices = request.nextUrl.searchParams.get('userBuffPrices') === '1';
  const wantsUserSettings = request.nextUrl.searchParams.get('userSettings') === '1';
  let scanChannelName: string | null = null;
  let responseChannelName: string | null = null;

  if (scanJobId) {
    const scanJobOwnerId = await resolveScanJobOwnerId(scanJobId);
    if (scanJobOwnerId !== ownerId) {
      return NextResponse.json({ message: 'jobNotFound' }, { status: 404 });
    }
    scanChannelName = getScanRealtimeChannelName(ownerId, scanJobId);
    responseChannelName = scanChannelName;
  }

  let adminBugReportsChannelName: string | null = null;
  if (wantsAdminBugReports) {
    if (!isAdminUser(user.email)) {
      return NextResponse.json({ message: 'unauthorized' }, { status: 403 });
    }
    adminBugReportsChannelName = getBugReportsRealtimeChannelName();
    responseChannelName = adminBugReportsChannelName;
  }

  let adminPostAnalysisChannelName: string | null = null;
  if (wantsAdminPostAnalysis) {
    if (!isAdminUser(user.email)) {
      return NextResponse.json({ message: 'unauthorized' }, { status: 403 });
    }
    adminPostAnalysisChannelName = getPostAnalysisHistoryRealtimeChannelName();
    responseChannelName = adminPostAnalysisChannelName;
  }

  let userBuffPricesChannelName: string | null = null;
  if (wantsUserBuffPrices) {
    userBuffPricesChannelName = getUserBuffPricesRealtimeChannelName(ownerId);
    responseChannelName = userBuffPricesChannelName;
  }

  let userSettingsChannelName: string | null = null;
  if (wantsUserSettings) {
    userSettingsChannelName = getUserSettingsRealtimeChannelName(ownerId);
    responseChannelName = userSettingsChannelName;
  }

  const capability: Record<string, string[]> = {};
  if (scanChannelName) {
    capability[scanChannelName] = ['subscribe'];
  }
  if (adminBugReportsChannelName) {
    capability[adminBugReportsChannelName] = ['subscribe'];
  }
  if (adminPostAnalysisChannelName) {
    capability[adminPostAnalysisChannelName] = ['subscribe'];
  }
  if (userBuffPricesChannelName) {
    capability[userBuffPricesChannelName] = ['subscribe'];
  }
  if (userSettingsChannelName) {
    capability[userSettingsChannelName] = ['subscribe'];
  }
  if (!responseChannelName) {
    capability[portfolioChannelName] = ['subscribe'];
  }

  const ably = new Ably.Rest({ key: apiKey });
  const tokenDetails = await ably.auth.requestToken({
    clientId: user.id,
    ttl: TOKEN_TTL_MS,
    capability: JSON.stringify(capability),
  });

  if (responseChannelName) {
    return NextResponse.json({ tokenDetails, channelName: responseChannelName });
  }

  return NextResponse.json(tokenDetails);
}

async function resolveScanJobOwnerId(jobId: string): Promise<string | null> {
  const memoryJob = getInMemoryJob(jobId);
  if (memoryJob) {
    return memoryJob.ownerId || null;
  }

  const db = await getDatabase();
  const doc = await db
    .collection('scan_jobs')
    .findOne({ id: jobId }, { projection: { ownerId: 1 } });
  return typeof doc?.ownerId === 'string' ? doc.ownerId : null;
}
