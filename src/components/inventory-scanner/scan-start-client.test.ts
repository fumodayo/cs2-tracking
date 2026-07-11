import { describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import { createScanStartClient, getScanStartErrorMessage } from './scan-start-client';

const t = ((key: string, options?: Record<string, unknown> | string) => {
  if (typeof options === 'string') return options;
  return typeof options?.defaultValue === 'string' ? options.defaultValue : key;
}) as TFunction;

describe('createScanStartClient', () => {
  it('posts a trimmed scan request and returns the job id', async () => {
    const fetchImpl = createFetchMock(
      () => new Response(JSON.stringify({ jobId: 123 }), { status: 200 })
    );
    const client = createScanStartClient({ t, fetchImpl: fetchImpl as typeof fetch });

    await expect(
      client.startInventoryScan({
        steamUrl: ' https://steamcommunity.com/id/example/ ',
        steamCookie: ' cookie ',
        steamSessionId: ' session ',
        forceRefresh: true,
      })
    ).resolves.toBe('123');

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/inventory/scan',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const [, init] = fetchImpl.mock.calls[0] as Parameters<typeof fetch>;
    expect(JSON.parse(String(init?.body))).toEqual({
      steamUrl: 'https://steamcommunity.com/id/example/',
      steamCookie: 'cookie',
      steamSessionId: 'session',
      forceRefresh: true,
      progress: true,
    });
  });

  it('omits blank optional credentials from the request body', async () => {
    const fetchImpl = createFetchMock(
      () => new Response(JSON.stringify({ jobId: 'job_a' }), { status: 200 })
    );
    const client = createScanStartClient({ t, fetchImpl: fetchImpl as typeof fetch });

    await client.startInventoryScan({
      steamUrl: '76561198000000000',
      steamCookie: '   ',
      steamSessionId: '',
      forceRefresh: false,
    });

    const [, init] = fetchImpl.mock.calls[0] as Parameters<typeof fetch>;
    expect(JSON.parse(String(init?.body))).toEqual({
      steamUrl: '76561198000000000',
      forceRefresh: false,
      progress: true,
    });
  });

  it('throws the existing login-required copy for 401 responses', async () => {
    const fetchImpl = createFetchMock(
      () => new Response(JSON.stringify({ message: 'unauthorized' }), { status: 401 })
    );
    const client = createScanStartClient({ t, fetchImpl: fetchImpl as typeof fetch });

    await expect(
      client.startInventoryScan({
        steamUrl: '76561198000000000',
        forceRefresh: false,
      })
    ).rejects.toThrow('Login required. Please log in to scan.');
  });
});

describe('getScanStartErrorMessage', () => {
  it('uses generic request copy when the backend did not send a message', () => {
    expect(getScanStartErrorMessage(500, {}, t)).toBe('Scan request failed.');
  });
});

function createFetchMock(createResponse: () => Response) {
  return vi.fn(async (...args: Parameters<typeof fetch>) => {
    void args;
    return createResponse();
  });
}
