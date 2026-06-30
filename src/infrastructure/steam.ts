import { fetchSteamApi } from "@/utils/api-client";
import { parseSteamCookies } from "@/utils/steam-cookies";
import type { ParsedSteamCookie } from "@/utils/steam-cookies";

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
  const idMatch = trimmed.match(/\/id\/([^/]+)/);
  if (idMatch) {
    vanityName = idMatch[1];
  } else if (!trimmed.includes("/")) {
    vanityName = trimmed;
  }

  if (!vanityName) {
    throw new Error("cannotRecognizeSteamLink");
  }

  // Resolve vanity → SteamID64 + profile via XML endpoint
  const xmlUrl = `https://steamcommunity.com/id/${vanityName}/?xml=1`;
  const response = await fetchSteamApi(xmlUrl);

  if (!response.ok) {
    throw new Error(`cannotFindSteamProfile:vanityName=${vanityName},status=${response.status}`);
  }

  const xml = await response.text();

  const steamIdMatch = xml.match(/<steamID64>(\d{17})<\/steamID64>/);
  if (!steamIdMatch) {
    throw new Error(`cannotFindSteamId64:vanityName=${vanityName}`);
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

export type { ParsedSteamCookie };

/**
 * Fetches the Steam wallet balance from the Steam store page using the provided cookie.
 * Parses the currency value and converts it to VND based on a predefined exchange rates map.
 */
export async function fetchSteamWalletBalance(
  steamCookie: string,
): Promise<{ raw: string; vnd: number } | null> {
  try {
    // 1. Try store page first (works if cookie has store domain permission)
    const responseStore = await fetchSteamApi("https://store.steampowered.com/", {
      headers: {
        Cookie: steamCookie,
      },
      cache: "no-store",
    });

    let html = "";
    let balanceMatch = null;
    if (responseStore.ok) {
      html = await responseStore.text();
      balanceMatch = html.match(/id="header_wallet_balance"[^>]*>([\s\S]*?)<\/(?:a|span)>/i)
        || html.match(/<[^>]*id="header_wallet_balance"[^>]*>([\s\S]*?)<\/[^>]*>/i);
    }
    console.log("[SteamWallet] Store response status:", responseStore.status, "balanceMatch:", balanceMatch ? balanceMatch[0] : null);

    // 2. Fall back to Steam Community Market page if store page didn't show balance
    if (!balanceMatch) {
      const CANONICAL_COOKIE_NAMES: Record<string, string> = {
        steamloginsecure: "steamLoginSecure",
        sessionid: "sessionid",
        steamparental: "steamparental",
        webtradeeligibility: "webTradeEligibility",
        steamcountry: "steamCountry",
      };

      const parsed = parseSteamCookies(steamCookie);
      const cookiesMap = new Map<string, string>();
      steamCookie.split(";").forEach(part => {
        const trimmed = part.trim();
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const rawKey = trimmed.substring(0, eqIdx).trim();
          const normKey = CANONICAL_COOKIE_NAMES[rawKey.toLowerCase()] || rawKey;
          cookiesMap.set(normKey, trimmed.substring(eqIdx + 1).trim());
        }
      });

      // Ensure sessionid exists
      if (!cookiesMap.has("sessionid")) {
        cookiesMap.set("sessionid", parsed.sessionid || "1234567890abcdef12345678");
      }

      const initialCookieHeader = Array.from(cookiesMap.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");

      // A. Call eligibilitycheck to get webTradeEligibility cookie (avoids market redirect loop)
      const resCheck = await fetchSteamApi("https://steamcommunity.com/market/eligibilitycheck/?goto=%2Fmarket%2F", {
        headers: {
          Cookie: initialCookieHeader,
        },
        redirect: "manual",
        cache: "no-store",
      } as RequestInit);

      if (resCheck.status === 302 || resCheck.status === 200) {
        const checkHeaders = resCheck.headers as Headers & { getSetCookie?: () => string[] };
        const setCookieHeaders = typeof checkHeaders.getSetCookie === "function"
          ? checkHeaders.getSetCookie()
          : (resCheck.headers.get("set-cookie") 
            ? [resCheck.headers.get("set-cookie")!] 
            : []);

        for (const cookieStr of setCookieHeaders) {
          const firstPart = cookieStr.split(";")[0].trim();
          const eqIdx = firstPart.indexOf("=");
          if (eqIdx !== -1) {
            const rawKey = firstPart.substring(0, eqIdx).trim();
            const normKey = CANONICAL_COOKIE_NAMES[rawKey.toLowerCase()] || rawKey;
            const v = firstPart.substring(eqIdx + 1);
            cookiesMap.set(normKey, v);
          }
        }
      }

      const mergedCookieHeader = Array.from(cookiesMap.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");

      // B. Fetch market homepage with eligibility cookie
      const resMarket = await fetchSteamApi("https://steamcommunity.com/market/", {
        headers: {
          Cookie: mergedCookieHeader,
        },
        redirect: "manual",
        cache: "no-store",
      } as RequestInit);

      if (resMarket.ok) {
        html = await resMarket.text();
        balanceMatch = html.match(/id="market_wallet_balance"[^>]*>([\s\S]*?)<\/span>/i)
          || html.match(/class="market_wallet_balance"[^>]*>([\s\S]*?)<\/span>/i)
          || html.match(/id="header_wallet_balance"[^>]*>([\s\S]*?)<\/(?:a|span)>/i)
          || html.match(/<[^>]*id="header_wallet_balance"[^>]*>([\s\S]*?)<\/[^>]*>/i);
        console.log("[SteamWallet] Market response status:", resMarket.status, "balanceMatch:", balanceMatch ? balanceMatch[0] : null);
      } else {
        console.log("[SteamWallet] Market response not OK. Status:", resMarket.status);
      }
    }

    if (!balanceMatch) return null;

    const htmlContent = balanceMatch[1];
    
    // Extract main balance (everything before the first HTML tag)
    const mainMatch = htmlContent.match(/^([^<]+)/);
    let mainBalance = mainMatch ? mainMatch[1].trim().replace(/\s+/g, " ") : "";
    
    if (!mainBalance) {
      // Fallback: strip tags if we can't find text node before tags
      mainBalance = htmlContent.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    }
    
    if (!mainBalance) return null;

    // Extract pending balance if exists (e.g. "Pending: 501,82₫" or "Chờ xử lý: 501,82₫")
    const viPendingLabel = ["Ch\u1edd", "x\u1eed", "l\u00fd"].join(" ");
    const pendingRegex = new RegExp(`(?:Pending|${viPendingLabel})\\s*:\\s*([^<]+)`, "i");
    const pendingMatch = htmlContent.match(pendingRegex);
    const pendingBalance = pendingMatch ? pendingMatch[1].trim().replace(/\s+/g, " ") : null;

    // Construct raw string: if pending exists, display as "Main (Chờ xử lý: Pending)"
    const cleaned = pendingBalance 
      ? `${mainBalance} (${viPendingLabel}: ${pendingBalance})`
      : mainBalance;

    // Rates map to convert to VND
    const rates: Record<string, number> = {
      "vnd": 1,
      "₫": 1,
      "đ": 1,
      "usd": 25000,
      "$": 25000,
      "eur": 27000,
      "€": 27000,
      "cny": 3500,
      "¥": 3500,
      "gbp": 32000,
      "£": 32000,
      "rub": 280,
      "pуб.": 280,
      "pyб": 280,
      "krw": 18,
      "₩": 18,
      "twd": 780,
      "nt$": 780,
      "aud": 16500,
      "a$": 16500,
      "cad": 18000,
      "c$": 18000,
      "sgd": 18500,
      "s$": 18500,
      "hkd": 3200,
      "hk$": 3200,
      "jpy": 160,
      "brl": 5000,
      "r$": 5000,
      "pln": 6200,
      "zł": 6200,
      "ars": 28,
      "try": 755,
      "tl": 755,
      "₴": 610,
      "uah": 610,
      "kzt": 55,
      "₸": 55,
    };

    const lowerText = cleaned.toLowerCase();
    let foundRate = 25000; // default to USD

    for (const [key, r] of Object.entries(rates)) {
      if (lowerText.includes(key)) {
        foundRate = r;
        break;
      }
    }

    const numMatch = cleaned.match(/[\d.,]+/);
    if (!numMatch) return { raw: cleaned, vnd: 0 };

    let numStr = numMatch[0];
    let vnd = 0;

    const hasDot = numStr.includes(".");
    const hasComma = numStr.includes(",");

    if (hasDot && hasComma) {
      const dotIdx = numStr.lastIndexOf(".");
      const commaIdx = numStr.lastIndexOf(",");
      if (dotIdx > commaIdx) {
        numStr = numStr.replace(/,/g, "");
      } else {
        numStr = numStr.replace(/\./g, "").replace(/,/g, ".");
      }
    } else if (hasDot) {
      const idx = numStr.lastIndexOf(".");
      const len = numStr.length - 1 - idx;
      if (len !== 2 && len !== 1) {
        numStr = numStr.replace(/\./g, "");
      }
    } else if (hasComma) {
      const idx = numStr.lastIndexOf(",");
      const len = numStr.length - 1 - idx;
      if (len === 2 || len === 1) {
        numStr = numStr.replace(/,/g, ".");
      } else {
        numStr = numStr.replace(/,/g, "");
      }
    }

    const val = parseFloat(numStr);
    vnd = isNaN(val) ? 0 : Math.round(val * foundRate);

    return { raw: cleaned, vnd };
  } catch (err) {
    console.error("fetchSteamWalletBalance error:", err);
    return null;
  }
}

