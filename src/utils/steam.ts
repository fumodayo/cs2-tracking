import { fetchSteamApi } from "@/utils/api-client";

export type SteamProfile = {
  name: string;
  avatarUrl: string | null;
};

export type SteamResolveResult = {
  steamId64: string;
  profile: SteamProfile;
};

export async function resolveSteamId(
  input: string,
): Promise<SteamResolveResult> {
  const trimmed = input.trim().replace(/\/+$/, "");

  // Full profile URL with numeric ID
  const profileMatch = trimmed.match(/\/profiles\/(\d{17})/);
  if (profileMatch) {
    const profile = await fetchSteamProfile(
      `https://steamcommunity.com/profiles/${profileMatch[1]}/?xml=1`,
    );
    return { steamId64: profileMatch[1], profile };
  }

  // Already a SteamID64 (17-digit number)
  const rawId64Match = trimmed.match(/^(\d{17})$/);
  if (rawId64Match) {
    const profile = await fetchSteamProfile(
      `https://steamcommunity.com/profiles/${rawId64Match[1]}/?xml=1`,
    );
    return { steamId64: rawId64Match[1], profile };
  }

  // Custom URL — extract vanity name
  let vanityName: string | null = null;
  const idMatch = trimmed.match(/\/id\/([^\/]+)/);
  if (idMatch) {
    vanityName = idMatch[1];
  } else if (!trimmed.includes("/")) {
    vanityName = trimmed;
  }

  if (!vanityName) {
    throw new Error(
      "Không thể nhận dạng link Steam. Hãy dán link profile hoặc SteamID64.",
    );
  }

  // Resolve vanity → SteamID64 + profile via XML endpoint
  const xmlUrl = `https://steamcommunity.com/id/${vanityName}/?xml=1`;
  const response = await fetchSteamApi(xmlUrl);

  if (!response.ok) {
    throw new Error(
      `Không tìm được profile Steam "${vanityName}" (HTTP ${response.status}).`,
    );
  }

  const xml = await response.text();

  const steamIdMatch = xml.match(/<steamID64>(\d{17})<\/steamID64>/);
  if (!steamIdMatch) {
    throw new Error(
      `Không tìm thấy SteamID64 cho custom URL "${vanityName}". Profile có thể không tồn tại.`,
    );
  }

  const profile = extractProfileFromXml(xml);
  return { steamId64: steamIdMatch[1], profile };
}

async function fetchSteamProfile(xmlUrl: string): Promise<SteamProfile> {
  try {
    const response = await fetchSteamApi(xmlUrl);
    if (!response.ok) return { name: "Unknown", avatarUrl: null };
    const xml = await response.text();
    return extractProfileFromXml(xml);
  } catch {
    return { name: "Unknown", avatarUrl: null };
  }
}

function extractProfileFromXml(xml: string): SteamProfile {
  const nameMatch = xml.match(/<steamID><!\[CDATA\[(.+?)\]\]><\/steamID>/);
  const avatarMatch = xml.match(
    /<avatarMedium><!\[CDATA\[(.+?)\]\]><\/avatarMedium>/,
  );
  return {
    name: nameMatch?.[1] ?? "Unknown",
    avatarUrl: avatarMatch?.[1] ?? null,
  };
}

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
  const result: ParsedSteamCookie = { steamLoginSecure: "" };
  if (!rawCookie) return result;

  if (!rawCookie.includes(";")) {
    const trimmed = rawCookie.trim();
    result.steamLoginSecure = trimmed
      .toLowerCase()
      .startsWith("steamloginsecure=")
      ? trimmed.substring(17).trim()
      : trimmed;
    return result;
  }

  const parts = rawCookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const k = trimmed.substring(0, eqIdx).toLowerCase();
    const v = trimmed.substring(eqIdx + 1).trim();

    if (k === "steamloginsecure") result.steamLoginSecure = v;
    else if (k === "steamparental") result.steamparental = v;
    else if (k === "sessionid") result.sessionid = v;
  }

  return result;
}

/**
 * Builds a standardized Steam cookie string from constituent parts.
 */
export function buildSteamCookie(
  steamLoginSecure: string,
  sessionid?: string,
  steamparental?: string,
): string {
  let combined = `steamLoginSecure=${steamLoginSecure}`;
  if (steamparental) combined += `; steamparental=${steamparental}`;
  if (sessionid) combined += `; sessionid=${sessionid}`;
  return combined;
}
