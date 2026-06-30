export type StickerCharmDefinition = {
  name: string;
  marketHashName?: string;
  imageUrl?: string;
};

export const STICKER_ID_MAP: Record<number, StickerCharmDefinition> = {};

export const CHARM_ID_MAP: Record<number, StickerCharmDefinition> = {};

export function getStickerDefinition(id: number): StickerCharmDefinition {
  return (
    STICKER_ID_MAP[id] ?? {
      name: `Sticker #${id}`,
    }
  );
}

export function getCharmDefinition(id: number): StickerCharmDefinition {
  return (
    CHARM_ID_MAP[id] ?? {
      name: `Charm #${id}`,
    }
  );
}
