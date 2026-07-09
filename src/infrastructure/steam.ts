import { fetchSteamApi } from '@/utils/api-client';
import { parseSteamCookies } from '@/utils/steam-cookies';
import type { ParsedSteamCookie } from '@/utils/steam-cookies';

export type SteamProfile = {
  name: string;
  avatarUrl: string | null;
};

export type SteamResolveResult = {
  steamId64: string;
  profile: SteamProfile;
};

export async function resolveSteamId(input: string): Promise<SteamResolveResult> {
  const trimmed = input.trim().replace(/\/+$/, '');

  // URL profile đầy đủ với ID dạng số
  const profileMatch = trimmed.match(/\/profiles\/(\d{17})/);
  if (profileMatch) {
    const profile = await fetchSteamProfile(
      `https://steamcommunity.com/profiles/${profileMatch[1]}/?xml=1`
    );
    return { steamId64: profileMatch[1], profile };
  }

  // Đã là SteamID64 (số 17 chữ số)
  const rawId64Match = trimmed.match(/^(\d{17})$/);
  if (rawId64Match) {
    const profile = await fetchSteamProfile(
      `https://steamcommunity.com/profiles/${rawId64Match[1]}/?xml=1`
    );
    return { steamId64: rawId64Match[1], profile };
  }

  // URL tùy chỉnh — trích vanity name
  let vanityName: string | null = null;
  const idMatch = trimmed.match(/\/id\/([^/]+)/);
  if (idMatch) {
    vanityName = idMatch[1];
  } else if (!trimmed.includes('/')) {
    vanityName = trimmed;
  }

  if (!vanityName) {
    throw new Error('cannotRecognizeSteamLink');
  }

  // Resolve vanity → SteamID64 + hồ sơ qua endpoint XML
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
    if (!response.ok) return { name: 'Unknown', avatarUrl: null };
    const xml = await response.text();
    return extractProfileFromXml(xml);
  } catch {
    return { name: 'Unknown', avatarUrl: null };
  }
}

function extractProfileFromXml(xml: string): SteamProfile {
  const nameMatch = xml.match(/<steamID><!\[CDATA\[(.+?)\]\]><\/steamID>/);
  const avatarMatch = xml.match(/<avatarMedium><!\[CDATA\[(.+?)\]\]><\/avatarMedium>/);
  return {
    name: nameMatch?.[1] ?? 'Unknown',
    avatarUrl: avatarMatch?.[1] ?? null,
  };
}

export type { ParsedSteamCookie };

/**
 *
 * Lấy số dư ví Steam từ trang Steam store bằng cookie được cung cấp.
 * Parse giá trị tiền tệ và đổi sang VND theo bảng tỷ giá định sẵn.
 *
 */
export async function fetchSteamWalletBalance(
  steamCookie: string
): Promise<{ raw: string; vnd: number } | null> {
  try {
    // 1. Thử trang store trước (hoạt động nếu cookie có quyền domain store)
    const responseStore = await fetchSteamApi('https://store.steampowered.com/', {
      headers: {
        Cookie: steamCookie,
      },
      cache: 'no-store',
    });

    let html = '';
    let balanceMatch = null;
    if (responseStore.ok) {
      html = await responseStore.text();
      balanceMatch =
        html.match(/id="header_wallet_balance"[^>]*>([\s\S]*?)<\/(?:a|span)>/i) ||
        html.match(/<[^>]*id="header_wallet_balance"[^>]*>([\s\S]*?)<\/[^>]*>/i);
    }
    console.log(
      '[SteamWallet] Store response status:',
      responseStore.status,
      'balanceMatch:',
      balanceMatch ? balanceMatch[0] : null
    );

    // 2. Dự phòng bằng trang Steam Community Market nếu trang store không hiện số dư
    if (!balanceMatch) {
      const CANONICAL_COOKIE_NAMES: Record<string, string> = {
        steamloginsecure: 'steamLoginSecure',
        sessionid: 'sessionid',
        steamparental: 'steamparental',
        webtradeeligibility: 'webTradeEligibility',
        steamcountry: 'steamCountry',
      };

      const parsed = parseSteamCookies(steamCookie);
      const cookiesMap = new Map<string, string>();
      steamCookie.split(';').forEach((part) => {
        const trimmed = part.trim();
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const rawKey = trimmed.substring(0, eqIdx).trim();
          const normKey = CANONICAL_COOKIE_NAMES[rawKey.toLowerCase()] || rawKey;
          cookiesMap.set(normKey, trimmed.substring(eqIdx + 1).trim());
        }
      });

      // Đảm bảo có sessionid
      if (!cookiesMap.has('sessionid')) {
        cookiesMap.set('sessionid', parsed.sessionid || '1234567890abcdef12345678');
      }

      const initialCookieHeader = Array.from(cookiesMap.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');

      // A. Gọi eligibilitycheck để lấy cookie webTradeEligibility, tránh vòng redirect market
      const resCheck = await fetchSteamApi(
        'https://steamcommunity.com/market/eligibilitycheck/?goto=%2Fmarket%2F',
        {
          headers: {
            Cookie: initialCookieHeader,
          },
          redirect: 'manual',
          cache: 'no-store',
        } as RequestInit
      );

      if (resCheck.status === 302 || resCheck.status === 200) {
        const checkHeaders = resCheck.headers as Headers & { getSetCookie?: () => string[] };
        const setCookieHeaders =
          typeof checkHeaders.getSetCookie === 'function'
            ? checkHeaders.getSetCookie()
            : resCheck.headers.get('set-cookie')
              ? [resCheck.headers.get('set-cookie')!]
              : [];

        for (const cookieStr of setCookieHeaders) {
          const firstPart = cookieStr.split(';')[0].trim();
          const eqIdx = firstPart.indexOf('=');
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
        .join('; ');

      // B. Fetch trang chủ market với cookie eligibility
      const resMarket = await fetchSteamApi('https://steamcommunity.com/market/', {
        headers: {
          Cookie: mergedCookieHeader,
        },
        redirect: 'manual',
        cache: 'no-store',
      } as RequestInit);

      if (resMarket.ok) {
        html = await resMarket.text();
        balanceMatch =
          html.match(/id="market_wallet_balance"[^>]*>([\s\S]*?)<\/span>/i) ||
          html.match(/class="market_wallet_balance"[^>]*>([\s\S]*?)<\/span>/i) ||
          html.match(/id="header_wallet_balance"[^>]*>([\s\S]*?)<\/(?:a|span)>/i) ||
          html.match(/<[^>]*id="header_wallet_balance"[^>]*>([\s\S]*?)<\/[^>]*>/i);
        console.log(
          '[SteamWallet] Market response status:',
          resMarket.status,
          'balanceMatch:',
          balanceMatch ? balanceMatch[0] : null
        );
      } else {
        console.log('[SteamWallet] Market response not OK. Status:', resMarket.status);
      }
    }

    if (!balanceMatch) return null;

    const htmlContent = balanceMatch[1];

    // Trích số dư chính (mọi thứ trước tag HTML đầu tiên)
    const mainMatch = htmlContent.match(/^([^<]+)/);
    let mainBalance = mainMatch ? mainMatch[1].trim().replace(/\s+/g, ' ') : '';

    if (!mainBalance) {
      // Dự phòng: bỏ tag nếu không tìm thấy text node trước tag
      mainBalance = htmlContent
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    if (!mainBalance) return null;

    // Trích số dư đang chờ nếu có (ví dụ "Pending: 501,82₫" hoặc "Chờ xử lý: 501,82₫")
    const viPendingLabel = ['Ch\u1edd', 'x\u1eed', 'l\u00fd'].join(' ');
    const pendingRegex = new RegExp(`(?:Pending|${viPendingLabel})\\s*:\\s*([^<]+)`, 'i');
    const pendingMatch = htmlContent.match(pendingRegex);
    const pendingBalance = pendingMatch ? pendingMatch[1].trim().replace(/\s+/g, ' ') : null;

    // Tạo chuỗi thô: nếu có pending, hiển thị dạng "Main (Chờ xử lý: Pending)"
    const cleaned = pendingBalance
      ? `${mainBalance} (${viPendingLabel}: ${pendingBalance})`
      : mainBalance;

    // Bảng tỷ giá để đổi sang VND
    const rates: Record<string, number> = {
      vnd: 1,
      '₫': 1,
      đ: 1,
      usd: 25000,
      $: 25000,
      eur: 27000,
      '€': 27000,
      cny: 3500,
      '¥': 3500,
      gbp: 32000,
      '£': 32000,
      rub: 280,
      'pуб.': 280,
      pyб: 280,
      krw: 18,
      '₩': 18,
      twd: 780,
      nt$: 780,
      aud: 16500,
      a$: 16500,
      cad: 18000,
      c$: 18000,
      sgd: 18500,
      s$: 18500,
      hkd: 3200,
      hk$: 3200,
      jpy: 160,
      brl: 5000,
      r$: 5000,
      pln: 6200,
      zł: 6200,
      ars: 28,
      try: 755,
      tl: 755,
      '₴': 610,
      uah: 610,
      kzt: 55,
      '₸': 55,
    };

    const lowerText = cleaned.toLowerCase();
    let foundRate = 25000; // Mặc định dùng USD.

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

    const hasDot = numStr.includes('.');
    const hasComma = numStr.includes(',');

    if (hasDot && hasComma) {
      const dotIdx = numStr.lastIndexOf('.');
      const commaIdx = numStr.lastIndexOf(',');
      if (dotIdx > commaIdx) {
        numStr = numStr.replace(/,/g, '');
      } else {
        numStr = numStr.replace(/\./g, '').replace(/,/g, '.');
      }
    } else if (hasDot) {
      const idx = numStr.lastIndexOf('.');
      const len = numStr.length - 1 - idx;
      if (len !== 2 && len !== 1) {
        numStr = numStr.replace(/\./g, '');
      }
    } else if (hasComma) {
      const idx = numStr.lastIndexOf(',');
      const len = numStr.length - 1 - idx;
      if (len === 2 || len === 1) {
        numStr = numStr.replace(/,/g, '.');
      } else {
        numStr = numStr.replace(/,/g, '');
      }
    }

    const val = parseFloat(numStr);
    vnd = isNaN(val) ? 0 : Math.round(val * foundRate);

    return { raw: cleaned, vnd };
  } catch (err) {
    console.error('fetchSteamWalletBalance error:', err);
    return null;
  }
}
