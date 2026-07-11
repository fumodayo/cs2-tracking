export type RecentImportItemDetail = {
  name: string;
  quantity: number;
  buyPrice: number;
  buyDate?: string;
  note?: string;
  createdAt?: string;
};

export type RecentImport = {
  id: string;
  fileName: string;
  date: string;
  importedCount: number;
  importedIds: string[];
  items?: RecentImportItemDetail[];
};

const MAX_RECENT_IMPORTS = 10;
const MAX_IMPORTED_IDS = 10_000;
const MAX_ITEM_DETAILS = 1_000;

export function normalizeRecentImport(value: unknown): RecentImport | null {
  if (!isRecord(value)) return null;

  const id = normalizeString(value.id, 128);
  const fileName = normalizeString(value.fileName, 512);
  if (!id || !fileName) return null;

  const importedIds = Array.isArray(value.importedIds)
    ? value.importedIds
        .map((item) => normalizeString(item, 128))
        .filter((item): item is string => Boolean(item))
        .slice(0, MAX_IMPORTED_IDS)
    : [];

  const importedCount = normalizePositiveInteger(value.importedCount, importedIds.length);
  const items = Array.isArray(value.items)
    ? value.items
        .map(normalizeRecentImportItemDetail)
        .filter((item): item is RecentImportItemDetail => Boolean(item))
        .slice(0, MAX_ITEM_DETAILS)
    : undefined;

  return {
    id,
    fileName,
    date: normalizeIsoDate(value.date) ?? new Date().toISOString(),
    importedCount,
    importedIds,
    ...(items && items.length > 0 ? { items } : {}),
  };
}

export function normalizeRecentImports(value: unknown): RecentImport[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(normalizeRecentImport)
    .filter((item): item is RecentImport => Boolean(item))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, MAX_RECENT_IMPORTS);
}

function normalizeRecentImportItemDetail(value: unknown): RecentImportItemDetail | null {
  if (!isRecord(value)) return null;

  const name = normalizeString(value.name, 512);
  if (!name) return null;
  const buyDate = normalizeIsoDate(value.buyDate);
  const note = normalizeString(value.note, 512);
  const createdAt = normalizeIsoDate(value.createdAt);

  return {
    name,
    quantity: normalizePositiveInteger(value.quantity, 1),
    buyPrice: normalizeFiniteNumber(value.buyPrice, 0),
    ...(buyDate ? { buyDate } : {}),
    ...(note ? { note } : {}),
    ...(createdAt ? { createdAt } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : fallback;
}

function normalizeFiniteNumber(value: unknown, fallback: number): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback;
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
