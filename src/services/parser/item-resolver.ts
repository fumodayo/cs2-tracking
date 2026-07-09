import type { CaseItem } from '@/domain/case-item';
import { DEFAULT_CASES } from '@/infrastructure/cases/default-cases';
import type { ParsedItem, ResolvedItem, ItemResolution } from './types';
import { normalizeForParsing } from './text-parser';

export const MANUAL_ALIASES: Record<string, string> = {
  dead: 'Sealed Dead Hand Terminal',
  'dead hand': 'Sealed Dead Hand Terminal',
  deadhand: 'Sealed Dead Hand Terminal',
  'dead hand terminal': 'Sealed Dead Hand Terminal',
  dream: 'Dreams & Nightmares Case',
  dreams: 'Dreams & Nightmares Case',
  nightmare: 'Dreams & Nightmares Case',
  nightmares: 'Dreams & Nightmares Case',
  'dream nightmare': 'Dreams & Nightmares Case',
  'dreams nightmares': 'Dreams & Nightmares Case',
  revo: 'Revolution Case',
  revolution: 'Revolution Case',
  recoil: 'Recoil Case',
  fracture: 'Fracture Case',
  kilo: 'Kilowatt Case',
  kilowatt: 'Kilowatt Case',
  fever: 'Fever Case',
  gallery: 'Gallery Case',
  snake: 'Snakebite Case',
  snakebite: 'Snakebite Case',
  clutch: 'Clutch Case',
  horizon: 'Horizon Case',
  prisma: 'Prisma Case',
  'prisma 2': 'Prisma 2 Case',
  'spectrum 2': 'Spectrum 2 Case',
  spectrum: 'Spectrum Case',
  glove: 'Glove Case',
  gamma: 'Gamma Case',
  'gamma 2': 'Gamma 2 Case',
  chroma: 'Chroma Case',
  'chroma 2': 'Chroma 2 Case',
  'chroma 3': 'Chroma 3 Case',
  wildfire: 'Operation Wildfire Case',
  vanguard: 'Operation Vanguard Weapon Case',
  breakout: 'Operation Breakout Weapon Case',
  phoenix: 'Operation Phoenix Weapon Case',
  huntsman: 'Huntsman Weapon Case',
  'broken fang': 'Operation Broken Fang Case',
  riptide: 'Operation Riptide Case',
  hydra: 'Operation Hydra Case',
  revolver: 'Revolver Case',
  shadow: 'Shadow Case',
  falchion: 'Falchion Case',
  'danger zone': 'Danger Zone Case',
  cs20: 'CS20 Case',
};

export function resolveParsedItems(parsedItems: ParsedItem[]): ItemResolution {
  const resolvedItems: ResolvedItem[] = [];
  const unknownItems: ParsedItem[] = [];

  for (const item of parsedItems) {
    const caseItem = resolveCaseItem(item.inputName, item.originalName);
    if (!caseItem) {
      unknownItems.push(item);
      continue;
    }

    const existing = resolvedItems.find(
      (resolvedItem) => resolvedItem.caseItem.marketHashName === caseItem.marketHashName
    );
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      resolvedItems.push({ ...item, caseItem });
    }
  }

  return { resolvedItems, unknownItems };
}

export function chooseItemResolution(
  geminiResolution: ItemResolution,
  localResolution: ItemResolution
): ItemResolution {
  if (geminiResolution.resolvedItems.length === 0) {
    return localResolution;
  }

  if (localResolution.resolvedItems.length === 0) {
    return geminiResolution;
  }

  return getResolvedQuantity(geminiResolution) >= getResolvedQuantity(localResolution)
    ? geminiResolution
    : localResolution;
}

export function getResolvedQuantity(resolution: ItemResolution): number {
  return resolution.resolvedItems.reduce((sum, item) => sum + item.quantity, 0);
}

export function getResolutionQuantity(resolution: ItemResolution): number {
  return (
    resolution.resolvedItems.reduce((sum, item) => sum + item.quantity, 0) +
    resolution.unknownItems.reduce((sum, item) => sum + item.quantity, 0)
  );
}

export function isGloveOrKnife(name: string): boolean {
  const lower = name.toLowerCase();
  const keywords = [
    'gloves',
    'wraps',
    'daggers',
    'bayonet',
    'karambit',
    'butterfly',
    'talon',
    'huntsman',
    'falchion',
    'bowie',
    'ursus',
    'stiletto',
    'navaja',
    'kukri',
    'skeleton knife',
    'nomad knife',
    'survival knife',
    'paracord knife',
    'classic knife',
    'flip knife',
    'gut knife',
  ];
  return keywords.some((keyword) => lower.includes(keyword));
}

export function resolveCaseItem(
  inputName: string,
  originalName?: string
): Omit<CaseItem, 'id' | 'isActive'> | null {
  const normalizedInput = normalizeAlias(inputName);

  // Dọn mô tả case phổ biến để trích tên gốc
  const caseDescriptors = [/\bcase\b/g, /\bhom\b/g, /\bhop\b/g, /\bthung\b/g, /\bbox\b/g];
  let baseInput = normalizedInput;
  for (const rx of caseDescriptors) {
    baseInput = baseInput.replace(rx, '');
  }
  baseInput = baseInput.replace(/\s+/g, ' ').trim();

  const checkMatch = (key: string) => {
    if (!key) return null;
    const manualMatch = MANUAL_ALIASES[key];
    if (manualMatch) {
      return findCaseByMarketHashName(manualMatch);
    }

    return DEFAULT_CASES.find((caseItem) => {
      const names = getGeneratedAliases(caseItem.marketHashName);
      return names.includes(key);
    });
  };

  const matchedCase = checkMatch(normalizedInput) || checkMatch(baseInput);
  if (matchedCase) {
    return matchedCase;
  }

  // Nếu là vật phẩm Steam động
  const nameToUse = originalName || inputName;
  const lowerName = nameToUse.toLowerCase();

  const hasPipe = lowerName.includes('|');
  const isSticker = lowerName.includes('sticker');
  const isCase =
    lowerName.includes('case') || lowerName.includes('hom') || lowerName.includes('hop');
  const isCapsule = lowerName.includes('capsule');
  const isSkin =
    lowerName.includes('mp9') ||
    lowerName.includes('ak-47') ||
    lowerName.includes('m4a4') ||
    lowerName.includes('m4a1-s') ||
    lowerName.includes('awp') ||
    lowerName.includes('tec-9') ||
    lowerName.includes('usp-s') ||
    lowerName.includes('glock-18');
  const isGloveOrKnifeItem = isGloveOrKnife(nameToUse);

  if (hasPipe || isSticker || isCase || isCapsule || isSkin || isGloveOrKnifeItem) {
    let formattedName = nameToUse;

    // Chuẩn hóa Souvenir (tiếng Việt "Lưu niệm")
    if (formattedName.toLowerCase().includes('lưu niệm')) {
      formattedName = formattedName.replace(/\(\s*lưu niệm\s*\)/gi, '').trim();
      if (!formattedName.toLowerCase().includes('souvenir')) {
        formattedName = `Souvenir ${formattedName}`;
      }
    }

    // Xóa ghi chú dao trong ngoặc
    formattedName = formattedName.replace(/\(\s*★\s*\)/gi, '').trim();

    // Dịch thuật ngữ dao từ tiếng Việt "Dao"
    if (formattedName.toLowerCase().includes('dao')) {
      formattedName = formattedName.replace(/\bdao\b/gi, '').trim();
      const lowerForm = formattedName.toLowerCase();
      if (
        (lowerForm.includes('kukri') ||
          lowerForm.includes('butterfly') ||
          lowerForm.includes('karambit') ||
          lowerForm.includes('bayonet') ||
          lowerForm.includes('huntsman') ||
          lowerForm.includes('bowie') ||
          lowerForm.includes('falchion') ||
          lowerForm.includes('ursus') ||
          lowerForm.includes('stiletto') ||
          lowerForm.includes('navaja') ||
          lowerForm.includes('nomad') ||
          lowerForm.includes('survival') ||
          lowerForm.includes('paracord') ||
          lowerForm.includes('classic') ||
          lowerForm.includes('flip') ||
          lowerForm.includes('gut') ||
          lowerForm.includes('skeleton')) &&
        !lowerForm.includes('knife') &&
        !lowerForm.includes('bayonet')
      ) {
        if (lowerForm.includes('kukri'))
          formattedName = formattedName.replace(/kukri/i, 'Kukri Knife');
        else if (lowerForm.includes('butterfly'))
          formattedName = formattedName.replace(/butterfly/i, 'Butterfly Knife');
        else if (lowerForm.includes('flip'))
          formattedName = formattedName.replace(/flip/i, 'Flip Knife');
        else if (lowerForm.includes('gut'))
          formattedName = formattedName.replace(/gut/i, 'Gut Knife');
        else if (lowerForm.includes('ursus'))
          formattedName = formattedName.replace(/ursus/i, 'Ursus Knife');
        else if (lowerForm.includes('stiletto'))
          formattedName = formattedName.replace(/stiletto/i, 'Stiletto Knife');
        else if (lowerForm.includes('navaja'))
          formattedName = formattedName.replace(/navaja/i, 'Navaja Knife');
        else if (lowerForm.includes('bowie'))
          formattedName = formattedName.replace(/bowie/i, 'Bowie Knife');
        else if (lowerForm.includes('falchion'))
          formattedName = formattedName.replace(/falchion/i, 'Falchion Knife');
        else if (lowerForm.includes('huntsman'))
          formattedName = formattedName.replace(/huntsman/i, 'Huntsman Knife');
      }
    }

    formattedName = formattedName.replace(/\s+/g, ' ').trim();

    // Viết hoa từ để phù hợp khi gửi tới Steam API
    if (formattedName === formattedName.toLowerCase()) {
      formattedName = formattedName
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }

    if (isGloveOrKnife(formattedName) && !formattedName.startsWith('★')) {
      formattedName = `★ ${formattedName}`;
    }

    return {
      name: formattedName,
      marketHashName: formattedName,
    };
  }

  return null;
}

export function findCaseByMarketHashName(
  marketHashName: string
): Omit<CaseItem, 'id' | 'isActive'> | null {
  return DEFAULT_CASES.find((caseItem) => caseItem.marketHashName === marketHashName) ?? null;
}

export function getGeneratedAliases(marketHashName: string): string[] {
  const normalized = normalizeAlias(marketHashName);
  return [
    normalized,
    normalizeAlias(normalized.replace(/\bcase\b/g, '')),
    normalizeAlias(normalized.replace(/\bweapon\b/g, '')),
    normalizeAlias(normalized.replace(/\boperation\b/g, '')),
    normalizeAlias(
      normalized
        .replace(/\boperation\b/g, '')
        .replace(/\bweapon\b/g, '')
        .replace(/\bcase\b/g, '')
    ),
  ];
}

export function normalizeAlias(value: string): string {
  return normalizeForParsing(value)
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
