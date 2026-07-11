import * as Ably from 'ably';

export type UserRecentImportsRealtimeAction = 'created' | 'merged' | 'deleted' | 'cleared';

export type UserRecentImportsRealtimePayload = {
  type: 'user-recent-imports.changed';
  ownerId: string;
  action: UserRecentImportsRealtimeAction;
  changedAt: string;
  detail?: Record<string, unknown>;
};

let ablyRestClient: Ably.Rest | null = null;

export async function publishUserRecentImportsChanged(
  ownerId: string,
  action: UserRecentImportsRealtimeAction,
  detail?: Record<string, unknown>
): Promise<void> {
  const client = getAblyRestClient();
  if (!client) return;

  try {
    await client.channels
      .get(getUserRecentImportsRealtimeChannelName(ownerId))
      .publish('user-recent-imports.changed', {
        type: 'user-recent-imports.changed',
        ownerId,
        action,
        changedAt: new Date().toISOString(),
        detail,
      } satisfies UserRecentImportsRealtimePayload);
  } catch (error) {
    console.error('Failed to publish user recent imports realtime event to Ably:', error);
  }
}

export function getUserRecentImportsRealtimeChannelName(ownerId: string): string {
  return `user:${ownerId}:recent-imports`;
}

function getAblyRestClient(): Ably.Rest | null {
  const apiKey = process.env.ABLY_API_KEY?.trim();
  if (!apiKey) return null;

  ablyRestClient ??= new Ably.Rest({ key: apiKey });
  return ablyRestClient;
}
