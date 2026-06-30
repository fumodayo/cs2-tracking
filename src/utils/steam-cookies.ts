export type ParsedSteamCookie = {
  steamLoginSecure: string;
  steamparental?: string;
  sessionid?: string;
};

/**
 * Parses a raw cookie string (either a full browser cookie header or a single token)
 * into its constituent Steam-related parts.
 */
export function parseSteamCookies(rawCookie: string): ParsedSteamCookie {
  const result: ParsedSteamCookie = { steamLoginSecure: '' };
  if (!rawCookie) return result;

  const cleanInput = rawCookie.trim().replace(/^["']|["']$/g, '');

  if (!cleanInput.includes(';')) {
    const trimmed = cleanInput.trim();
    result.steamLoginSecure = trimmed.toLowerCase().startsWith('steamloginsecure=')
      ? trimmed
          .substring(17)
          .trim()
          .replace(/^["']|["']$/g, '')
      : trimmed;
    return result;
  }

  const parts = cleanInput.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const k = trimmed.substring(0, eqIdx).trim().toLowerCase();
    const v = trimmed
      .substring(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');

    if (k === 'steamloginsecure') result.steamLoginSecure = v;
    else if (k === 'steamparental') result.steamparental = v;
    else if (k === 'sessionid') result.sessionid = v;
  }

  return result;
}

/**
 * Builds a standardized Steam cookie string from constituent parts.
 */
export function buildSteamCookie(
  steamLoginSecure: string,
  sessionid?: string,
  steamparental?: string
): string {
  let combined = `steamLoginSecure=${steamLoginSecure}`;
  if (steamparental) combined += `; steamparental=${steamparental}`;
  if (sessionid) combined += `; sessionid=${sessionid}`;
  return combined;
}

/**
 * Merges an incoming (possibly masked) cookie string with the existing database cookie string.
 * If an optional part is omitted or masked (starts with "****"), it retains the value from the existing cookie.
 * Send an explicit empty value (e.g. "sessionid=") to clear an optional part.
 */
export function mergeIncomingCookieWithExisting(incoming: string, existing: string): string {
  if (!incoming) return '';
  if (!existing) return incoming;

  const parsedIncoming = parseSteamCookies(incoming);
  const parsedExisting = parseSteamCookies(existing);

  const steamLoginSecure =
    parsedIncoming.steamLoginSecure && parsedIncoming.steamLoginSecure.startsWith('****')
      ? parsedExisting.steamLoginSecure
      : parsedIncoming.steamLoginSecure;

  const keepOptionalCookiePart = (
    incomingValue: string | undefined,
    existingValue: string | undefined
  ) => {
    if (incomingValue === undefined) return existingValue;
    if (incomingValue.startsWith('****')) return existingValue;
    return incomingValue;
  };

  const sessionid = keepOptionalCookiePart(parsedIncoming.sessionid, parsedExisting.sessionid);

  const steamparental = keepOptionalCookiePart(
    parsedIncoming.steamparental,
    parsedExisting.steamparental
  );

  return buildSteamCookie(steamLoginSecure || '', sessionid || '', steamparental || '');
}

/**
 * Returns a masked preview of the steam cookie containing only the last 4 characters of each token.
 */
export function getCookiePreview(cookie: string): string {
  if (!cookie) return '';
  const parsed = parseSteamCookies(cookie);
  const parts: string[] = [];
  if (parsed.steamLoginSecure) {
    const clean = parsed.steamLoginSecure.trim();
    parts.push(`steamLoginSecure=****${clean.slice(-Math.min(4, clean.length))}`);
  }
  if (parsed.steamparental) {
    const clean = parsed.steamparental.trim();
    parts.push(`steamparental=****${clean.slice(-Math.min(4, clean.length))}`);
  }
  if (parsed.sessionid) {
    const clean = parsed.sessionid.trim();
    parts.push(`sessionid=****${clean.slice(-Math.min(4, clean.length))}`);
  }
  return parts.join('; ');
}
