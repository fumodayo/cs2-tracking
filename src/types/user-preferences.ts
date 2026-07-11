export type UserColumnMapping = {
  name: number;
  quantity?: number;
  buyPrice?: number;
  buyDate?: number;
  note?: number;
  caseId?: number;
};

export type UserExcelMappingTemplate = {
  id: string;
  label: string;
  headerFingerprint: string;
  mapping: UserColumnMapping;
  createdAt: string;
};

export type UserPricingPreferences = {
  rateSi?: number;
  rateLe?: number;
  buffCnyToVndRate?: number;
};

export type UserPricingPreferenceKey = keyof UserPricingPreferences;

export type UserPreferences = {
  excelMappingTemplates: UserExcelMappingTemplate[];
  pricing: UserPricingPreferences;
};

export const USER_PRICING_DEFAULTS = {
  rateSi: 60,
  rateLe: 65,
  buffCnyToVndRate: 3600,
} as const satisfies Record<UserPricingPreferenceKey, number>;

const PRICING_LIMITS = {
  rateSi: { min: 0, max: 100 },
  rateLe: { min: 0, max: 100 },
  buffCnyToVndRate: { min: 1, max: 100_000 },
} as const satisfies Record<UserPricingPreferenceKey, { min: number; max: number }>;

const PRICING_KEYS = Object.keys(USER_PRICING_DEFAULTS) as UserPricingPreferenceKey[];
const MAX_MAPPING_TEMPLATES = 50;
const MAX_COLUMN_INDEX = 200;

export function normalizeUserPreferences(value: unknown): UserPreferences {
  const source = isRecord(value) ? value : {};
  return {
    excelMappingTemplates: normalizeExcelMappingTemplates(source.excelMappingTemplates),
    pricing: normalizeUserPricingPreferences(source.pricing),
  };
}

export function normalizeExcelMappingTemplates(value: unknown): UserExcelMappingTemplate[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(normalizeExcelMappingTemplate)
    .filter((template): template is UserExcelMappingTemplate => Boolean(template))
    .slice(0, MAX_MAPPING_TEMPLATES);
}

export function normalizeUserPricingPreferences(value: unknown): UserPricingPreferences {
  if (!isRecord(value)) return {};

  const pricing: UserPricingPreferences = {};
  for (const key of PRICING_KEYS) {
    const normalized = normalizePricingValue(key, value[key]);
    if (normalized !== null) {
      pricing[key] = normalized;
    }
  }
  return pricing;
}

export function normalizePricingValue(
  key: UserPricingPreferenceKey,
  value: unknown
): number | null {
  const numberValue = Number(value);
  const limits = PRICING_LIMITS[key];

  if (!Number.isFinite(numberValue) || numberValue < limits.min || numberValue > limits.max) {
    return null;
  }

  return numberValue;
}

function normalizeExcelMappingTemplate(value: unknown): UserExcelMappingTemplate | null {
  if (!isRecord(value)) return null;

  const id = normalizeString(value.id, 128);
  const label = normalizeString(value.label, 120);
  const headerFingerprint = normalizeString(value.headerFingerprint, 2_000);
  const mapping = normalizeColumnMapping(value.mapping);

  if (!id || !label || !headerFingerprint || !mapping) return null;

  return {
    id,
    label,
    headerFingerprint,
    mapping,
    createdAt: normalizeIsoDate(value.createdAt) ?? new Date().toISOString(),
  };
}

function normalizeColumnMapping(value: unknown): UserColumnMapping | null {
  if (!isRecord(value)) return null;

  const name = normalizeColumnIndex(value.name);
  if (name === null) return null;

  const mapping: UserColumnMapping = { name };
  for (const key of ['quantity', 'buyPrice', 'buyDate', 'note', 'caseId'] as const) {
    const columnIndex = normalizeColumnIndex(value[key]);
    if (columnIndex !== null) {
      mapping[key] = columnIndex;
    }
  }

  return mapping;
}

function normalizeColumnIndex(value: unknown): number | null {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 0 || numberValue > MAX_COLUMN_INDEX) {
    return null;
  }

  return numberValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
