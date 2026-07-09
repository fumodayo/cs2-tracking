import * as Ably from 'ably';

export type BugReportRealtimeAction = 'created' | 'updated';

export type BugReportRealtimePayload = {
  type: 'bug-report.changed';
  action: BugReportRealtimeAction;
  changedAt: string;
  detail?: Record<string, unknown>;
};

let ablyRestClient: Ably.Rest | null = null;

export async function publishBugReportChanged(
  action: BugReportRealtimeAction,
  detail?: Record<string, unknown>
): Promise<void> {
  const client = getAblyRestClient();
  if (!client) return;

  try {
    await client.channels.get(getBugReportsRealtimeChannelName()).publish('bug-report.changed', {
      type: 'bug-report.changed',
      action,
      changedAt: new Date().toISOString(),
      detail,
    } satisfies BugReportRealtimePayload);
  } catch (error) {
    console.error('Failed to publish bug report realtime event to Ably:', error);
  }
}

export function getBugReportsRealtimeChannelName(): string {
  return 'admin:bug-reports';
}

function getAblyRestClient(): Ably.Rest | null {
  const apiKey = process.env.ABLY_API_KEY?.trim();
  if (!apiKey) return null;

  ablyRestClient ??= new Ably.Rest({ key: apiKey });
  return ablyRestClient;
}
