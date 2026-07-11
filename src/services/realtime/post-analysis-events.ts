import * as Ably from 'ably';

export type PostAnalysisHistoryRealtimeAction = 'saved' | 'touched' | 'deleted';

export type PostAnalysisHistoryRealtimePayload = {
  type: 'post-analysis-history.changed';
  action: PostAnalysisHistoryRealtimeAction;
  changedAt: string;
  detail?: Record<string, unknown>;
};

let ablyRestClient: Ably.Rest | null = null;
let warnedAblyPublishUnauthorized = false;

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
    if (isAblyPublishUnauthorized(error)) {
      if (!warnedAblyPublishUnauthorized) {
        warnedAblyPublishUnauthorized = true;
        console.warn(
          'ABLY_API_KEY is not allowed to publish post analysis history events. Admin clients will continue through direct API refreshes.'
        );
      }
      return;
    }
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

function isAblyPublishUnauthorized(error: unknown): boolean {
  const maybeAblyError = error as { code?: unknown; statusCode?: unknown };
  return maybeAblyError.code === 40160 || maybeAblyError.statusCode === 401;
}
