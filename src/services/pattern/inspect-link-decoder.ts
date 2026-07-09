import { decodeLink } from '@csfloat/cs2-inspect-serializer';

export type DecodedSticker = {
  id?: number;
  slot?: number;
  wear?: number;
};

export type DecodedKeychain = {
  id?: number;
  slot?: number;
  pattern?: number;
};

export type DecodedInspectLink = {
  paintSeed: number;
  floatValue: number;
  paintIndex: number;
  defIndex: number;
  stickers: DecodedSticker[];
  keychains: DecodedKeychain[];
};

/**
 *
 * Giải mã CS2 inspect link offline bằng @csfloat/cs2-inspect-serializer.
 * Trả về null nếu link thuộc dạng cũ, không hợp lệ hoặc không parse được.
 *
 */
export function decodeInspectLink(link: string): DecodedInspectLink | null {
  if (!link) return null;
  try {
    const decoded = decodeLink(link);
    if (
      decoded &&
      typeof decoded.paintseed === 'number' &&
      typeof decoded.paintwear === 'number' &&
      typeof decoded.paintindex === 'number'
    ) {
      return {
        paintSeed: decoded.paintseed,
        floatValue: decoded.paintwear,
        paintIndex: decoded.paintindex,
        defIndex: decoded.defindex || 0,
        stickers: normalizeStickers(decoded.stickers),
        keychains: normalizeKeychains(decoded.keychains),
      };
    }
  } catch (err) {
    // Fail mềm với link legacy hoặc không phải định dạng Protobuf
    console.debug('[decodeInspectLink] Failed to decode link offline:', err);
  }
  return null;
}

function normalizeStickers(value: unknown): DecodedSticker[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const source = item as Record<string, unknown>;
    const id = getNumber(source.stickerId) ?? getNumber(source.sticker_id);
    return {
      id,
      slot: getNumber(source.slot),
      wear: getNumber(source.wear) ?? (id !== undefined ? 0 : undefined),
    };
  });
}

function normalizeKeychains(value: unknown): DecodedKeychain[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const source = item as Record<string, unknown>;
    return {
      id:
        getNumber(source.stickerId) ?? getNumber(source.sticker_id) ?? getNumber(source.keychainId),
      slot: getNumber(source.slot),
      pattern: getNumber(source.pattern),
    };
  });
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
