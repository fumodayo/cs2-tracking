import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getSteamCaseImageUrl', () => {
  it('does not cache a temporary empty Steam response', async () => {
    const marketHashName = 'Temporary Empty Response Capsule';
    const iconUrl = 'test-icon';
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ success: false, results: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          results: [
            {
              hash_name: marketHashName,
              asset_description: { icon_url: iconUrl },
            },
          ],
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const { getSteamCaseImageUrl, lookupSteamCaseImage } =
      await import('./steam-case-image-provider');

    await expect(lookupSteamCaseImage(marketHashName)).resolves.toEqual({
      status: 'retryable-error',
    });
    await expect(getSteamCaseImageUrl(marketHashName)).resolves.toBe(
      `https://community.cloudflare.steamstatic.com/economy/image/${iconUrl}/96fx96f`
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent requests and caches successful image URLs', async () => {
    const marketHashName = 'Successful Image Capsule';
    const iconUrl = 'successful-icon';
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        success: true,
        results: [
          {
            hash_name: marketHashName,
            asset_description: { icon_url: iconUrl },
          },
        ],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { getSteamCaseImageUrl } = await import('./steam-case-image-provider');
    const expectedUrl = `https://community.cloudflare.steamstatic.com/economy/image/${iconUrl}/96fx96f`;

    await expect(
      Promise.all([getSteamCaseImageUrl(marketHashName), getSteamCaseImageUrl(marketHashName)])
    ).resolves.toEqual([expectedUrl, expectedUrl]);
    await expect(getSteamCaseImageUrl(marketHashName)).resolves.toBe(expectedUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    expect(new URL(String(requestUrl)).searchParams.get('query')).toBe(marketHashName);
    expect(requestInit).toEqual(expect.objectContaining({ cache: 'no-store' }));
  });

  it('distinguishes a confirmed missing item from a temporary Steam failure', async () => {
    const marketHashName = 'Not Indexed CS2 Case';
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        success: true,
        results: [],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { lookupSteamCaseImage } = await import('./steam-case-image-provider');

    await expect(lookupSteamCaseImage(marketHashName)).resolves.toEqual({
      status: 'not-found',
    });
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
