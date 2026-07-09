import * as Ably from 'ably';

export type PostAnalysisHistoryRealtimeAction = 'saved' | 'touched' | 'deleted';

export type PostAnalysisHistoryRealtimePayload = {
  type: 'post-analysis-history.changed';
  action: PostAnalysisHistoryRealtimeAction;
  changedAt: string;
  detail?: Record<string, unknown>;
};

let ablyRestClient: Ably.Rest | null = null;

export async function publishPostAnalysisHistoryChanged(
  action: PostAnalysisHistoryRealtimeAction,
  detail?: Record<string, unknown>
): Promise<void> {
  const client = getAblyRestClient();
  if (!client) return;

  try {
    await client.channels
      .get(getPostAnalysisHistoryRealtimeChannelName())
      .publish('post-analysis-history.changed', {
        type: 'post-analysis-history.changed',
        action,
        changedAt: new Date().toISOString(),
        detail,
      } satisfies PostAnalysisHistoryRealtimePayload);
  } catch (error) {
    console.error('Failed to publish post analysis history realtime event to Ably:', error);
  }
}

export function getPostAnalysisHistoryRealtimeChannelName(): string {
  return 'admin:post-analysis-history';
}

function getAblyRestClient(): Ably.Rest | null {
  const apiKey = process.env.ABLY_API_KEY?.trim();
  if (!apiKey) return null;

  ablyRestClient ??= new Ably.Rest({ key: apiKey });
  return ablyRestClient;
}
