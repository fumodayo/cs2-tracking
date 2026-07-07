import type { PatternInfo } from '@/domain/pattern-info';

export const STEAM_IMAGE_CDN = 'https://community.cloudflare.steamstatic.com/economy/image';

type SteamDescription = {
  value: string;
};

type ParsedAccessoryDescription = {
  name: string;
  marketHashName: string;
  imageUrl?: string;
};

export function parseAccessoryDescriptions(descriptions: SteamDescription[]): {
  stickers: ParsedAccessoryDescription[];
  charms: ParsedAccessoryDescription[];
} {
  const stickers: ParsedAccessoryDescription[] = [];
  const charms: ParsedAccessoryDescription[] = [];

  for (const description of descriptions) {
    const html = description.value;
    const lowerHtml = html.toLowerCase();
    if (
      !lowerHtml.includes('sticker:') &&
      !lowerHtml.includes('charm:') &&
      !lowerHtml.includes('keychain:')
    ) {
      continue;
    }

    const parsedFromImages = parseAccessoryImages(html);
    stickers.push(...parsedFromImages.stickers);
    charms.push(...parsedFromImages.charms);

    if (parsedFromImages.stickers.length === 0) {
      stickers.push(...parseAccessoryText(html, 'sticker'));
    }
    if (parsedFromImages.charms.length === 0) {
      charms.push(...parseAccessoryText(html, 'charm'));
      charms.push(...parseAccessoryText(html, 'keychain'));
    }
  }

  return { stickers, charms };
}

export function enrichPatternInfoWithSteamStickerDescriptions(
  patternInfo: PatternInfo | undefined,
  stickerDescriptions: ParsedAccessoryDescription[],
  charmDescriptions: ParsedAccessoryDescription[]
): PatternInfo | undefined {
  if (!patternInfo || (stickerDescriptions.length === 0 && charmDescriptions.length === 0)) {
    return patternInfo;
  }

  const existing = patternInfo.stickers ?? [];
  const maxLength = Math.max(existing.length, stickerDescriptions.length);
  const stickers = Array.from({ length: maxLength }, (_, index) => {
    const current = existing[index];
    const parsed = stickerDescriptions[index];
    return {
      ...current,
      name: parsed?.name ?? current?.name ?? `Sticker ${index + 1}`,
      marketHashName: parsed?.marketHashName ?? current?.marketHashName,
      imageUrl: parsed?.imageUrl ?? current?.imageUrl,
      slot: current?.slot ?? index,
      wear: current?.wear ?? 0,
    };
  });

  const existingCharms = patternInfo.charms ?? [];
  const maxCharmLength = Math.max(existingCharms.length, charmDescriptions.length);
  const charms = Array.from({ length: maxCharmLength }, (_, index) => {
    const current = existingCharms[index];
    const parsed = charmDescriptions[index];
    return {
      ...current,
      name: parsed?.name ?? current?.name ?? `Charm ${index + 1}`,
      marketHashName: parsed?.marketHashName ?? current?.marketHashName,
      imageUrl: parsed?.imageUrl ?? current?.imageUrl,
      slot: current?.slot ?? index,
    };
  });

  return {
    ...patternInfo,
    stickers: stickers.length > 0 ? stickers : patternInfo.stickers,
    charms: charms.length > 0 ? charms : patternInfo.charms,
  };
}

export function getMarketHashNameLookupKey(value: string): string {
  const trimmed = value.trim();
  try {
    return decodeURIComponent(trimmed).trim().toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

function parseAccessoryImages(html: string): {
  stickers: ParsedAccessoryDescription[];
  charms: ParsedAccessoryDescription[];
} {
  const stickers: ParsedAccessoryDescription[] = [];
  const charms: ParsedAccessoryDescription[] = [];
  const imageTags = html.match(/<img\b[^>]*>/gi) ?? [];

  for (const imageTag of imageTags) {
    const attrs = parseHtmlAttributes(imageTag);
    const title = decodeHtmlEntities(attrs.title ?? '');
    const src = attrs.src ? normalizeSteamImageUrl(attrs.src) : undefined;
    const accessory = parseAccessoryTitle(title, src);
    if (!accessory) continue;

    if (isCharmLabel(accessory.label)) {
      charms.push(accessory.description);
    } else {
      stickers.push(accessory.description);
    }
  }

  return { stickers, charms };
}

function parseAccessoryText(
  html: string,
  label: 'sticker' | 'charm' | 'keychain'
): ParsedAccessoryDescription[] {
  const text = decodeHtmlEntities(stripHtml(html));
  const match = text.match(new RegExp(`${label}:\\s*(.+)`, 'i'));
  if (!match?.[1]) return [];

  return match[1]
    .split(/\s*,\s*/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => buildAccessoryDescription(label, name));
}

function parseAccessoryTitle(
  title: string,
  imageUrl?: string
): { label: string; description: ParsedAccessoryDescription } | null {
  const match = title.match(/^\s*(sticker|charm|keychain):\s*(.+)$/i);
  if (!match?.[2]) return null;
  const label = match[1].toLowerCase();
  return {
    label,
    description: buildAccessoryDescription(label, match[2].trim(), imageUrl),
  };
}

function buildAccessoryDescription(
  label: string,
  name: string,
  imageUrl?: string
): ParsedAccessoryDescription {
  const prefix = isCharmLabel(label) ? 'Charm' : 'Sticker';
  return {
    name,
    marketHashName: name.toLowerCase().startsWith(`${prefix.toLowerCase()} |`)
      ? name
      : `${prefix} | ${name}`,
    imageUrl,
  };
}

function parseHtmlAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(/\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)=(["'])(.*?)\2/g)) {
    attrs[match[1].toLowerCase()] = decodeHtmlEntities(match[3]);
  }
  return attrs;
}

function isCharmLabel(label: string): boolean {
  return label.toLowerCase() === 'charm' || label.toLowerCase() === 'keychain';
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeSteamImageUrl(url: string): string {
  const normalized = decodeHtmlEntities(url.trim());
  if (normalized.startsWith('//')) return `https:${normalized}`;
  if (normalized.startsWith('/economy/image/')) {
    return `https://community.cloudflare.steamstatic.com${normalized}`;
  }
  if (normalized.startsWith('http://')) {
    return normalized.replace(/^http:\/\//i, 'https://');
  }
  return normalized;
}
