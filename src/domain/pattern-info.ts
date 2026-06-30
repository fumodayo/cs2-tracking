export type DopplerPhase =
  | "Phase 1"
  | "Phase 2"
  | "Phase 3"
  | "Phase 4"
  | "Ruby"
  | "Sapphire"
  | "Emerald"
  | "Black Pearl";

export type FadeTier =
  | "Full Fade"
  | "96-99%"
  | "90-95%"
  | "85-89%"
  | "80-84%";

export type BlueGemTier = "T1" | "T2" | "T3" | "T4" | "Normal";

export type MarbleFadeTier =
  | "True Fire & Ice"
  | "Fake Fire & Ice"
  | "Tricolor"
  | "Blue Dom"
  | "Red Dom"
  | "Normal";

export type StickerInfo = {
  id?: number;
  slot?: number;
  wear?: number;
  name: string;
  marketHashName?: string;
  imageUrl?: string;
};

export type CharmInfo = {
  id?: number;
  slot?: number;
  pattern?: number;
  name: string;
  marketHashName?: string;
  imageUrl?: string;
};

export type PatternInfo = {
  paintSeed?: number;
  floatValue?: number;
  dopplerPhase?: DopplerPhase;
  fadePercentage?: number;
  fadeTier?: FadeTier;
  blueGemTier?: BlueGemTier;
  marbleFadeTier?: MarbleFadeTier;
  stickers?: StickerInfo[];
  charms?: CharmInfo[];
  isSouvenir?: boolean;
  inspectLink?: string;
  checkedAt?: string;
};
