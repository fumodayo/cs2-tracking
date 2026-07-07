import { getDatabase } from '@/infrastructure/db/mongo-client';
import { extractSteamIdFromCookie } from '@/services/scan-steam-fetcher';
import { USER_AGENTS } from '@/utils/api-client';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout';
import { parseSteamCookies } from '@/utils/steam-cookies';

const STEAM_COOKIE_VALIDATE_TIMEOUT_MS = 12_000;

type SteamCookieParts = {
  cookieValue: string;
  parentalCookie: string;
  sessionidCookie: string;
};

export function parseSteamScanCookie(steamCookie: string, steamId64: string): SteamCookieParts {
  const parsed = parseSteamCookies(steamCookie);
  const cookieValue = parsed.steamLoginSecure;
  const cookieSteamId = extractSteamIdFromCookie(cookieValue);

  if (!cookieSteamId) {
    throw new Error('cookieInvalidFormat');
  }
  if (cookieSteamId !== steamId64) {
    throw new Error(`cookieSteamIdMismatch:cookieSteamId=${cookieSteamId},steamId64=${steamId64}`);
  }

  return {
    cookieValue,
    parentalCookie: parsed.steamparental || '',
    sessionidCookie: parsed.sessionid || '',
  };
}

export function buildSteamCookieHeader({
  cookieValue,
  parentalCookie,
  sessionidCookie,
}: SteamCookieParts): string {
  const cookieParts = [`steamLoginSecure=${cookieValue}`];
  if (parentalCookie) {
    cookieParts.push(`steamparental=${parentalCookie}`);
  }
  if (sessionidCookie) {
    cookieParts.push(`sessionid=${sessionidCookie}`);
  }
  return cookieParts.join('; ');
}

export async function validateSteamCookieSession({
  cookieHeader,
  steamId64,
  ownerId,
}: {
  cookieHeader: string;
  steamId64: string;
  ownerId?: string;
}) {
  let validateRes: Response | null = null;
  try {
    validateRes = await fetchWithTimeout(
      'https://steamcommunity.com/my/inventory',
      {
        headers: {
          'User-Agent': USER_AGENTS.steamBrowser,
          Cookie: cookieHeader,
        },
        redirect: 'manual',
      },
      STEAM_COOKIE_VALIDATE_TIMEOUT_MS
    );
  } catch (err) {
    console.warn(
      '[InventoryScanner] Cookie preflight timed out/failed. Proceeding to actual fetch...',
      err
    );
  }

  if (!validateRes) {
    return;
  }

  if (validateRes.status === 302) {
    const location = validateRes.headers.get('location') || '';
    if (location.includes('/login/')) {
      if (ownerId) {
        const db = await getDatabase();
        await db.collection('portfolio_accounts').updateOne(
          { steamId64, ownerId },
          {
            $set: {
              steamCookie: '',
              cookieError: 'cookieExpired',
            },
          }
        );
      }
      throw new Error('cookieExpired');
    }
  } else if (validateRes.status === 403) {
    console.warn(
      `[InventoryScanner] /my/inventory returned 403 (Family View). Proceeding to actual fetch...`
    );
  }
}

export function buildSteamInventoryHeaders(
  steamId64: string,
  cookieHeader?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENTS.steamBrowser,
    Referer: `https://steamcommunity.com/profiles/${steamId64}/inventory/`,
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  return headers;
}
