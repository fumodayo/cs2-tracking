export type ParsedSteamCookie = {
  steamLoginSecure: string;
  steamparental?: string;
  sessionid?: string;
};

/**
 *
 *
 * Phân tích chuỗi cookie thô, có thể là tiêu đề cookie đầy đủ của trình duyệt hoặc một token đơn
 * thành các phần liên quan tới Steam.
 *
 *
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
 * Tạo chuỗi cookie Steam chuẩn hóa từ các phần thành phần.
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
 *
 * Gộp chuỗi cookie đầu vào, có thể đã mask, với chuỗi cookie hiện có trong database.
 * Nếu phần tùy chọn bị bỏ trống hoặc đã mask (bắt đầu bằng "****"), giữ lại giá trị từ cookie hiện có.
 * Gửi giá trị rỗng tường minh (ví dụ "sessionid=") để xóa một phần tùy chọn.
 *
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
 * Trả về bản xem trước cookie Steam đã mask, chỉ giữ 4 ký tự cuối của mỗi token.
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
