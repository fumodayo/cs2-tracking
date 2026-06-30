export function isSafeUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    const host = url.hostname.toLowerCase();

    // Whitelist check
    const allowedDomains = [
      'steamstatic.com',
      'steampowered.com',
      'steamcommunity.com',
      'cloudinary.com',
      'fbcdn.net',
      'facebook.com',
    ];

    const isWhitelisted = allowedDomains.some(
      (domain) => host === domain || host.endsWith('.' + domain)
    );

    if (!isWhitelisted) {
      return false;
    }

    // IP Address checks (prevent accessing private ranges)
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.startsWith('169.254.') || // Link-local
      host.startsWith('10.') || // Private class A
      host.startsWith('192.168.') || // Private class C
      host.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) // Private class B
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function proxySteamUrl(urlStr: string): string {
  if (!urlStr) return urlStr;
  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase();
    if (
      host.includes('steamstatic.com') ||
      host.includes('steampowered.com') ||
      host.includes('steamcommunity.com')
    ) {
      return `/api/image-proxy?url=${encodeURIComponent(urlStr)}`;
    }
  } catch {
    // ignore
  }
  return urlStr;
}
