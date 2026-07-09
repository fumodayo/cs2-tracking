import type { CharmInfo, PatternInfo, DopplerPhase, StickerInfo } from '@/domain/pattern-info';
import type { DecodedKeychain, DecodedSticker } from './inspect-link-decoder';
import { getCharmDefinition, getStickerDefinition } from '@/data/sticker-id-map';
import { getFadePercentage } from './fade-analyzer';
import { getBlueGemTier } from './blue-gem-analyzer';
import { getMarbleFadeTier } from './marble-fade-analyzer';

type AnalyzePatternOptions = {
  stickers?: DecodedSticker[];
  keychains?: DecodedKeychain[];
};

export async function analyzePattern(
  marketHashName: string,
  paintSeed: number,
  floatValue?: number,
  paintIndex?: number,
  existingDopplerPhase?: string,
  options: AnalyzePatternOptions = {}
): Promise<PatternInfo> {
  const info: PatternInfo = { paintSeed, floatValue };
  const isSouvenir = marketHashName.toLowerCase().includes('souvenir');
  if (isSouvenir) {
    info.isSouvenir = true;
  }

  // 1. Pha Doppler
  if (existingDopplerPhase) {
    info.dopplerPhase = existingDopplerPhase as DopplerPhase;
  } else if (paintIndex) {
    info.dopplerPhase = detectDopplerFromPaintIndex(paintIndex);
  } else if (marketHashName.toLowerCase().includes('doppler')) {
    const mhn = marketHashName.toLowerCase();
    if (mhn.includes('ruby')) info.dopplerPhase = 'Ruby';
    else if (mhn.includes('sapphire')) info.dopplerPhase = 'Sapphire';
    else if (mhn.includes('emerald')) info.dopplerPhase = 'Emerald';
    else if (mhn.includes('black pearl')) info.dopplerPhase = 'Black Pearl';
  }

  // 2. Phần trăm Fade
  const fade = getFadePercentage(marketHashName, paintSeed);
  if (fade) {
    info.fadePercentage = fade.percentage;
    info.fadeTier = fade.tier;
  }

  // 3. Tier Blue Gem
  const blueGem = getBlueGemTier(marketHashName, paintSeed);
  if (blueGem) {
    info.blueGemTier = blueGem;
  }

  // 4. Tier Marble Fade
  const marbleFade = getMarbleFadeTier(marketHashName, paintSeed);
  if (marbleFade) {
    info.marbleFadeTier = marbleFade;
  }

  const stickers = mapStickers(options.stickers);
  if (stickers.length > 0) {
    info.stickers = stickers;
  }

  const charms = mapCharms(options.keychains);
  if (charms.length > 0) {
    info.charms = charms;
  }

  info.checkedAt = new Date().toISOString();
  return info;
}

function mapStickers(stickers: DecodedSticker[] = []): StickerInfo[] {
  return stickers
    .filter((sticker) => sticker.id !== undefined)
    .map((sticker) => {
      const definition = getStickerDefinition(sticker.id!);
      return {
        id: sticker.id,
        slot: sticker.slot,
        wear: sticker.wear,
        name: definition.name,
        marketHashName: definition.marketHashName,
        imageUrl: definition.imageUrl,
      };
    });
}

function mapCharms(keychains: DecodedKeychain[] = []): CharmInfo[] {
  return keychains
    .filter((keychain) => keychain.id !== undefined)
    .map((keychain) => {
      const definition = getCharmDefinition(keychain.id!);
      return {
        id: keychain.id,
        slot: keychain.slot,
        pattern: keychain.pattern,
        name: definition.name,
        marketHashName: definition.marketHashName,
        imageUrl: definition.imageUrl,
      };
    });
}

function detectDopplerFromPaintIndex(paintIndex: number): DopplerPhase | undefined {
  const mapping: Record<number, DopplerPhase> = {
    415: 'Ruby',
    416: 'Sapphire',
    417: 'Black Pearl',
    418: 'Phase 1',
    419: 'Phase 2',
    420: 'Phase 3',
    421: 'Phase 4',
    568: 'Emerald',
    569: 'Phase 1',
    570: 'Phase 2',
    571: 'Phase 3',
    572: 'Phase 4',
  };
  return mapping[paintIndex];
}
