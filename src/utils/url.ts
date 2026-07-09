const SAFE_IMAGE_HOSTS = new Set([
  'community.cloudflare.steamstatic.com',
  'avatars.steamstatic.com',
  'avatars.akamai.steamstatic.com',
  'res.cloudinary.com',
  'fbcdn.net',
  'steamstatic.com',
  'steampowered.com',
  'steamcommunity.com',
  'googleusercontent.com',
]);

const SAFE_IMAGE_DOMAIN_SUFFIXES = [
  '.fbcdn.net',
  '.steamstatic.com',
  '.steampowered.com',
  '.steamcommunity.com',
  '.googleusercontent.com',
] as const;

export function isSafeUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'https:') {
      return false;
    }

    const host = url.hostname.toLowerCase();
    if (url.username || url.password || url.port || url.pathname.includes('\\')) {
      return false;
    }

    const isWhitelisted =
      SAFE_IMAGE_HOSTS.has(host) ||
      SAFE_IMAGE_DOMAIN_SUFFIXES.some((suffix) => host.endsWith(suffix));

    if (!isWhitelisted) {
      return false;
    }

    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.startsWith('169.254.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
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
      host.endsWith('.steamstatic.com') ||
      host.endsWith('.steampowered.com') ||
      host.endsWith('.steamcommunity.com')
    ) {
      return `/api/image-proxy?url=${encodeURIComponent(urlStr)}`;
    }
  } catch {
    // Ignore invalid URLs.
  }
  return urlStr;
}
