import * as Ably from 'ably';

export type UserBuffPricesRealtimeAction = 'merged' | 'replaced' | 'updated';

export type UserBuffPricesRealtimePayload = {
  type: 'user-buff-prices.changed';
  ownerId: string;
  action: UserBuffPricesRealtimeAction;
  changedAt: string;
  detail?: Record<string, unknown>;
};

let ablyRestClient: Ably.Rest | null = null;
let warnedAblyPublishUnauthorized = false;

export async function publishUserBuffPricesChanged(
  ownerId: string,
  action: UserBuffPricesRealtimeAction,
  detail?: Record<string, unknown>
): Promise<void> {
  const client = getAblyRestClient();
  if (!client) return;

  try {
    await client.channels
      .get(getUserBuffPricesRealtimeChannelName(ownerId))
      .publish('user-buff-prices.changed', {
        type: 'user-buff-prices.changed',
        ownerId,
        action,
        changedAt: new Date().toISOString(),
        detail,
      } satisfies UserBuffPricesRealtimePayload);
  } catch (error) {
    if (isAblyPublishUnauthorized(error)) {
      if (!warnedAblyPublishUnauthorized) {
        warnedAblyPublishUnauthorized = true;
        console.warn(
          'ABLY_API_KEY is not allowed to publish user BUFF price events. BUFF price clients will continue through direct API refreshes.'
        );
      }
      return;
    }
    console.error('Failed to publish user BUFF prices realtime event to Ably:', error);
  }
}

export function getUserBuffPricesRealtimeChannelName(ownerId: string): string {
  return `user:${ownerId}:buff-prices`;
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
