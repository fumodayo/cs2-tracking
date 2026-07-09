import * as Ably from 'ably';

export type UserSettingsRealtimeAction =
  | 'cs2cap_key_added'
  | 'cs2cap_key_selected'
  | 'cs2cap_key_deleted';

export type UserSettingsRealtimePayload = {
  type: 'user-settings.changed';
  ownerId: string;
  action: UserSettingsRealtimeAction;
  changedAt: string;
  detail?: Record<string, unknown>;
};

let ablyRestClient: Ably.Rest | null = null;

export async function publishUserSettingsChanged(
  ownerId: string,
  action: UserSettingsRealtimeAction,
  detail?: Record<string, unknown>
): Promise<void> {
  const client = getAblyRestClient();
  if (!client) return;

  try {
    await client.channels
      .get(getUserSettingsRealtimeChannelName(ownerId))
      .publish('user-settings.changed', {
        type: 'user-settings.changed',
        ownerId,
        action,
        changedAt: new Date().toISOString(),
        detail,
      } satisfies UserSettingsRealtimePayload);
  } catch (error) {
    console.error('Failed to publish user settings realtime event to Ably:', error);
  }
}

export function getUserSettingsRealtimeChannelName(ownerId: string): string {
  return `user:${ownerId}:settings`;
}

function getAblyRestClient(): Ably.Rest | null {
  const apiKey = process.env.ABLY_API_KEY?.trim();
  if (!apiKey) return null;

  ablyRestClient ??= new Ably.Rest({ key: apiKey });
  return ablyRestClient;
}
