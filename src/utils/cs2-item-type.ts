export type Cs2PortfolioItemType =
  | 'case'
  | 'capsule'
  | 'sticker'
  | 'skin'
  | 'graffiti'
  | 'agent'
  | 'music_kit'
  | 'patch'
  | 'pin'
  | 'charm';

export type Cs2InventoryItemType =
  | 'Case'
  | 'Capsule'
  | 'Sticker'
  | 'Skin'
  | 'Graffiti'
  | 'Agent'
  | 'Music Kit'
  | 'Patch'
  | 'Pin'
  | 'Charm';

export type Cs2ItemTag = {
  category?: string;
  internal_name?: string;
  localized_tag_name?: string;
};

export type Cs2ItemTypeInput = {
  name?: string | null;
  marketHashName?: string | null;
  steamType?: string | null;
  tags?: Cs2ItemTag[] | null;
};

const PORTFOLIO_TO_INVENTORY_TYPE: Record<Cs2PortfolioItemType, Cs2InventoryItemType> = {
  case: 'Case',
  capsule: 'Capsule',
  sticker: 'Sticker',
  skin: 'Skin',
  graffiti: 'Graffiti',
  agent: 'Agent',
  music_kit: 'Music Kit',
  patch: 'Patch',
  pin: 'Pin',
  charm: 'Charm',
};

const INVENTORY_TO_PORTFOLIO_TYPE: Record<Cs2InventoryItemType, Cs2PortfolioItemType> = {
  Case: 'case',
  Capsule: 'capsule',
  Sticker: 'sticker',
  Skin: 'skin',
  Graffiti: 'graffiti',
  Agent: 'agent',
  'Music Kit': 'music_kit',
  Patch: 'patch',
  Pin: 'pin',
  Charm: 'charm',
};

export function toInventoryItemType(type: Cs2PortfolioItemType): Cs2InventoryItemType {
  return PORTFOLIO_TO_INVENTORY_TYPE[type];
}

export function toPortfolioItemType(type: string): Cs2PortfolioItemType {
  return (INVENTORY_TO_PORTFOLIO_TYPE as Record<string, Cs2PortfolioItemType>)[type] ?? 'case';
}

export function inferInventoryItemType(input: Cs2ItemTypeInput): Cs2InventoryItemType {
  return toInventoryItemType(inferPortfolioItemType(input));
}

export function inferPortfolioItemType(input: Cs2ItemTypeInput): Cs2PortfolioItemType {
  const { names, searchable, steamType, typeSignals } = normalizeInput(input);

  if (hasAny(searchable, ['capsule', 'package']) || hasAny(typeSignals, ['capsule', 'package'])) {
    return 'capsule';
  }

  if (
    startsWithAny(names, ['sticker |']) ||
    searchable.includes('sticker |') ||
    hasAny(typeSignals, ['sticker'])
  ) {
    return 'sticker';
  }

  if (isContainerLike(searchable, steamType, typeSignals)) {
    return 'case';
  }

  if (
    startsWithAny(names, ['sealed graffiti |', 'graffiti |']) ||
    hasAny(steamType, ['graffiti']) ||
    hasAny(typeSignals, ['graffiti', 'spray'])
  ) {
    return 'graffiti';
  }

  if (
    startsWithAny(names, ['music kit |', 'stattrak music kit |', 'stattrak(tm) music kit |']) ||
    hasAny(steamType, ['music kit']) ||
    hasAny(typeSignals, ['music kit'])
  ) {
    return 'music_kit';
  }

  if (
    startsWithAny(names, ['patch |']) ||
    hasAny(steamType, ['patch']) ||
    hasAny(typeSignals, ['patch'])
  ) {
    return 'patch';
  }

  if (
    startsWithAny(names, ['pin |', 'collectible pin']) ||
    hasAny(steamType, ['pin', 'collectible']) ||
    hasAny(typeSignals, ['pin', 'collectible'])
  ) {
    return 'pin';
  }

  if (
    startsWithAny(names, ['charm |']) ||
    hasAny(steamType, ['charm', 'keychain']) ||
    hasAny(typeSignals, ['charm', 'keychain'])
  ) {
    return 'charm';
  }

  if (isAgentLike(searchable, steamType, typeSignals)) {
    return 'agent';
  }

  if (searchable.includes(' | ')) {
    return 'skin';
  }

  return 'case';
}

function normalizeInput(input: Cs2ItemTypeInput) {
  const rawNames = [input.name, input.marketHashName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase());
  const names = Array.from(new Set(rawNames));
  const searchable = names.join(' ');
  const steamType = input.steamType?.trim().toLowerCase() ?? '';
  const typeTagText =
    input.tags
      ?.filter((tag) => tag.category?.toLowerCase() === 'type')
      .flatMap((tag) => [tag.internal_name, tag.localized_tag_name])
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
      .toLowerCase() ?? '';

  return {
    names,
    searchable,
    steamType,
    typeSignals: `${steamType} ${typeTagText}`.trim(),
  };
}

function isContainerLike(searchable: string, steamType: string, typeSignals: string): boolean {
  const hasSkinSeparator = searchable.includes(' | ');

  return (
    (!hasSkinSeparator && searchable.includes('case')) ||
    steamType.includes('container') ||
    typeSignals.includes('container') ||
    typeSignals.includes('weapon case')
  );
}

function isAgentLike(searchable: string, steamType: string, typeSignals: string): boolean {
  const agentSignals = [
    'agent',
    'biet kich',
    ' | ksk',
    ' | fbi',
    ' | swat',
    ' | sas',
    ' | nswc',
    ' | elite crew',
    ' | phoenix',
    ' | sabre',
    ' | gendarmerie',
    ' | guerilla',
  ];

  return (
    startsWithAny([searchable], ['agent |']) ||
    hasAny(searchable, agentSignals) ||
    hasAny(steamType, ['agent']) ||
    hasAny(typeSignals, ['agent'])
  );
}

function startsWithAny(values: string[], prefixes: string[]): boolean {
  return values.some((value) => prefixes.some((prefix) => value.startsWith(prefix)));
}

function hasAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}
