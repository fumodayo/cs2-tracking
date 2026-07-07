type SteamDescriptionText = {
  value?: string;
};

type SteamDescriptionTag = {
  category?: string;
  internal_name?: string;
  localized_tag_name?: string;
  color?: string;
};

type SteamItemDescription = {
  market_hash_name?: string;
  type?: string;
  marketable?: number;
  tags?: SteamDescriptionTag[];
  descriptions?: SteamDescriptionText[];
  owner_descriptions?: SteamDescriptionText[];
};

export function isStorageUnitDescription(desc: SteamItemDescription): boolean {
  if (desc.market_hash_name === 'Storage Unit') return true;
  if (desc.type?.toLowerCase().includes('storage container')) return true;
  if (desc.market_hash_name?.toLowerCase().includes('storage container')) return true;

  const isTool =
    desc.type?.toLowerCase().includes('tool') ||
    desc.tags?.some(
      (tag) => tag.category === 'Type' && tag.internal_name?.toLowerCase().includes('tool')
    );

  const hasStorageText =
    desc.descriptions?.some(
      (item) =>
        item.value?.toLowerCase().includes('storage unit') &&
        item.value?.toLowerCase().includes('1,000')
    ) ||
    desc.owner_descriptions?.some(
      (item) =>
        item.value?.toLowerCase().includes('storage unit') &&
        item.value?.toLowerCase().includes('1,000')
    );

  return Boolean(isTool && hasStorageText);
}

export function shouldIncludeSteamDescription(
  desc: SteamItemDescription,
  isSpecialState: boolean
): boolean {
  const nameLower = desc.market_hash_name?.toLowerCase() || '';
  const typeLower = desc.type?.toLowerCase() || '';
  const isKey =
    nameLower.includes('key') &&
    (nameLower.includes('case') ||
      nameLower.includes('capsule') ||
      nameLower.includes('sticker') ||
      typeLower.includes('key'));

  return Boolean(desc.marketable || isSpecialState || isKey);
}

export function getRarityFromDescription(
  desc: SteamItemDescription
): { name: string; color: string } | undefined {
  const rarityTag = desc.tags?.find((tag) => tag.category === 'Rarity');
  if (!rarityTag?.localized_tag_name) return undefined;

  return {
    name: rarityTag.localized_tag_name,
    color: rarityTag.color ? `#${rarityTag.color}` : '#b0c3d9',
  };
}

export function getDopplerPhaseFromDescription(desc: SteamItemDescription): string | undefined {
  for (const tag of desc.tags ?? []) {
    const tagName = tag.localized_tag_name || '';
    const tagInternal = tag.internal_name || '';

    if (tagName.includes('Phase 1') || tagInternal.includes('phase1')) return 'Phase 1';
    if (tagName.includes('Phase 2') || tagInternal.includes('phase2')) return 'Phase 2';
    if (tagName.includes('Phase 3') || tagInternal.includes('phase3')) return 'Phase 3';
    if (tagName.includes('Phase 4') || tagInternal.includes('phase4')) return 'Phase 4';
    if (tagName.includes('Ruby') || tagInternal.includes('ruby')) return 'Ruby';
    if (tagName.includes('Sapphire') || tagInternal.includes('sapphire')) return 'Sapphire';
    if (tagName.includes('Emerald') || tagInternal.includes('emerald')) return 'Emerald';
    if (tagName.includes('Black Pearl') || tagInternal.includes('blackpearl')) {
      return 'Black Pearl';
    }
  }

  return undefined;
}
