type AccessoryLike = {
  id?: number;
  slot?: number;
  wear?: number;
  pattern?: number;
  name?: string;
  marketHashName?: string;
};

type PatternLike = {
  paintSeed?: number;
  paintIndex?: number;
  floatValue?: number;
  dopplerPhase?: string;
  stickers?: AccessoryLike[];
  charms?: AccessoryLike[];
};

type SourceAccountLike = {
  steamId64?: string;
  name?: string;
  breakdown?: {
    tradeable?: number;
    onMarket?: number;
    tradeProtected?: number;
    hold?: number;
  };
};

export type ItemIdentityInput = {
  caseId?: string;
  marketHashName?: string;
  dopplerPhase?: string;
  inspectLink?: string;
  patternInfo?: unknown;
  sourceAccounts?: SourceAccountLike[];
  holdDays?: number;
  tradeHoldUntil?: string | Date;
  onMarket?: boolean;
  tradeProtected?: boolean;
};

export function buildItemIdentityKey(input: ItemIdentityInput): string {
  const itemKey = normalizeIdentityPart(input.caseId ?? input.marketHashName ?? 'unknown');
  const phaseKey = normalizeIdentityPart(input.dopplerPhase ?? 'normal');
  const assetKey = buildAssetIdentityPart(input);
  const ownerKey = buildOwnerIdentityPart(input.sourceAccounts);
  const statusKey = buildStatusIdentityPart(input);

  return [itemKey, phaseKey, assetKey, ownerKey, statusKey].join(':');
}

export function buildItemVariantKey(input: ItemIdentityInput): string {
  const itemKey = normalizeIdentityPart(input.caseId ?? input.marketHashName ?? 'unknown');
  const phaseKey = normalizeIdentityPart(input.dopplerPhase ?? 'normal');
  const assetKey = buildAssetIdentityPart(input);

  return [itemKey, phaseKey, assetKey].join(':');
}

function buildAssetIdentityPart(input: ItemIdentityInput): string {
  const inspectLink = normalizeIdentityPart(input.inspectLink);
  if (inspectLink) {
    return `inspect=${inspectLink}`;
  }

  const pattern = normalizePattern(input.patternInfo);
  if (!pattern) {
    return 'bulk';
  }

  return `pattern=${pattern}`;
}

function buildOwnerIdentityPart(accounts: SourceAccountLike[] | undefined): string {
  if (!accounts || accounts.length === 0) {
    return 'owner=unknown';
  }

  const parts = accounts
    .map((account) => {
      const steamId64 = normalizeIdentityPart(account.steamId64 ?? account.name);
      if (!steamId64) return null;
      const breakdown = account.breakdown;
      return [
        steamId64,
        breakdown?.tradeable ?? 0,
        breakdown?.onMarket ?? 0,
        breakdown?.tradeProtected ?? 0,
        breakdown?.hold ?? 0,
      ].join(',');
    })
    .filter((value): value is string => Boolean(value))
    .sort();

  return parts.length > 0 ? `owner=${parts.join('+')}` : 'owner=unknown';
}

function buildStatusIdentityPart(input: ItemIdentityInput): string {
  const holdUntil =
    input.tradeHoldUntil instanceof Date
      ? input.tradeHoldUntil.toISOString()
      : input.tradeHoldUntil;

  return [
    input.onMarket ? 'market' : 'inv',
    input.tradeProtected ? 'protected' : 'unprotected',
    input.holdDays && input.holdDays > 0 ? `hold=${input.holdDays}` : 'hold=0',
    holdUntil ? `until=${normalizeIdentityPart(holdUntil)}` : '',
  ]
    .filter(Boolean)
    .join(',');
}

function normalizePattern(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const pattern = value as PatternLike;
  const parts = [
    numberPart('paintSeed', pattern.paintSeed),
    numberPart('paintIndex', pattern.paintIndex),
    numberPart('float', pattern.floatValue, 8),
    stringPart('phase', pattern.dopplerPhase),
    accessoryPart('stickers', pattern.stickers),
    accessoryPart('charms', pattern.charms),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join('|') : null;
}

function accessoryPart(label: string, accessories: AccessoryLike[] | undefined) {
  if (!Array.isArray(accessories) || accessories.length === 0) {
    return '';
  }

  const values = accessories
    .map((accessory, index) => {
      const slot = accessory.slot ?? index;
      const name = normalizeIdentityPart(accessory.marketHashName ?? accessory.name);
      const id = accessory.id ?? '';
      const wear =
        accessory.wear !== undefined && Number.isFinite(accessory.wear)
          ? Number(accessory.wear).toFixed(6)
          : '';
      const pattern =
        accessory.pattern !== undefined && Number.isFinite(accessory.pattern)
          ? accessory.pattern
          : '';
      return [slot, id, name, wear, pattern].join(',');
    })
    .sort();

  return `${label}=[${values.join(';')}]`;
}

function numberPart(label: string, value: number | undefined, fractionDigits = 0) {
  if (value === undefined || !Number.isFinite(value)) {
    return '';
  }

  const normalized = fractionDigits > 0 ? Number(value).toFixed(fractionDigits) : String(value);
  return `${label}=${normalized}`;
}

function stringPart(label: string, value: string | undefined) {
  const normalized = normalizeIdentityPart(value);
  return normalized ? `${label}=${normalized}` : '';
}

function normalizeIdentityPart(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
