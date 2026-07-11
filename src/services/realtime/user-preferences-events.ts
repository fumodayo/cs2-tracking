import * as Ably from 'ably';

export type UserPreferencesRealtimeAction = 'updated';

export type UserPreferencesRealtimePayload = {
  type: 'user-preferences.changed';
  ownerId: string;
  action: UserPreferencesRealtimeAction;
  changedAt: string;
  detail?: Record<string, unknown>;
};

let ablyRestClient: Ably.Rest | null = null;

export async function publishUserPreferencesChanged(
  ownerId: string,
  action: UserPreferencesRealtimeAction,
  detail?: Record<string, unknown>
): Promise<void> {
  const client = getAblyRestClient();
  if (!client) return;

  try {
    await client.channels
      .get(getUserPreferencesRealtimeChannelName(ownerId))
      .publish('user-preferences.changed', {
        type: 'user-preferences.changed',
        ownerId,
        action,
        changedAt: new Date().toISOString(),
        detail,
      } satisfies UserPreferencesRealtimePayload);
  } catch (error) {
    console.error('Failed to publish user preferences realtime event to Ably:', error);
  }
}

export function getUserPreferencesRealtimeChannelName(ownerId: string): string {
  return `user:${ownerId}:preferences`;
}

function getAblyRestClient(): Ably.Rest | null {
  const apiKey = process.env.ABLY_API_KEY?.trim();
  if (!apiKey) return null;

  ablyRestClient ??= new Ably.Rest({ key: apiKey });
  return ablyRestClient;
}
