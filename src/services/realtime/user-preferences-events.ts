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
let warnedAblyPublishUnauthorized = false;

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
    if (isAblyPublishUnauthorized(error)) {
      if (!warnedAblyPublishUnauthorized) {
        warnedAblyPublishUnauthorized = true;
        console.warn(
          'ABLY_API_KEY is not allowed to publish user preference events. Preference clients will continue through direct API refreshes.'
        );
      }
      return;
    }
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

function isAblyPublishUnauthorized(error: unknown): boolean {
  const maybeAblyError = error as { code?: unknown; statusCode?: unknown };
  return maybeAblyError.code === 40160 || maybeAblyError.statusCode === 401;
}
