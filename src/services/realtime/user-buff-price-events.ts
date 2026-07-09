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
