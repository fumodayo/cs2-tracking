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
let warnedAblyPublishUnauthorized = false;

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
    if (isAblyPublishUnauthorized(error)) {
      if (!warnedAblyPublishUnauthorized) {
        warnedAblyPublishUnauthorized = true;
        console.warn(
          'ABLY_API_KEY is not allowed to publish user setting events. Settings clients will continue through direct API refreshes.'
        );
      }
      return;
    }
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

function isAblyPublishUnauthorized(error: unknown): boolean {
  const maybeAblyError = error as { code?: unknown; statusCode?: unknown };
  return maybeAblyError.code === 40160 || maybeAblyError.statusCode === 401;
}
