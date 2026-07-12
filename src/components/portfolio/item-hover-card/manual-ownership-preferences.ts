import type { PortfolioRowSourceType } from '../portfolio-table-model';
import type { ItemHoverCardFormValues } from './item-hover-card-form-values';
import type { ItemTradeState } from './lot-update-helpers';

export const MANUAL_OWNERSHIP_PREFERENCES_KEY = 'item_hover_card_manual_ownership_preferences_v1';

export type ManualOwnershipPreferences = Pick<
  ItemHoverCardFormValues,
  'editAccountId' | 'editStorageUnitId' | 'editState' | 'editHoldDays'
>;

type StorageReader = {
  getItem(key: string): string | null;
};

type StorageWriter = {
  setItem(key: string, value: string): void;
};

export function readManualOwnershipPreferences(
  storage: StorageReader
): ManualOwnershipPreferences | null {
  try {
    const saved = storage.getItem(MANUAL_OWNERSHIP_PREFERENCES_KEY);
    if (!saved) return null;

    return normalizeManualOwnershipPreferences(JSON.parse(saved));
  } catch {
    return null;
  }
}

export function writeManualOwnershipPreferences(
  storage: StorageWriter,
  preferences: ManualOwnershipPreferences
): void {
  try {
    storage.setItem(
      MANUAL_OWNERSHIP_PREFERENCES_KEY,
      JSON.stringify(normalizeManualOwnershipPreferences(preferences) ?? getEmptyPreferences())
    );
  } catch {
    // localStorage is only a convenience; a storage failure must not fail the item update.
  }
}

export function applyManualOwnershipPreferences(
  values: ItemHoverCardFormValues,
  sourceType: PortfolioRowSourceType,
  preferences: ManualOwnershipPreferences | null
): ItemHoverCardFormValues {
  if (sourceType !== 'manual' || !preferences) return values;

  return {
    ...values,
    ...preferences,
  };
}

function normalizeManualOwnershipPreferences(value: unknown): ManualOwnershipPreferences | null {
  if (!isRecord(value)) return null;

  const editAccountId = readString(value.editAccountId);
  const editStorageUnitId = readString(value.editStorageUnitId);
  const editState = readTradeState(value.editState);
  const editHoldDays = readString(value.editHoldDays);

  if (
    editAccountId === null ||
    editStorageUnitId === null ||
    editState === null ||
    editHoldDays === null
  ) {
    return null;
  }

  return {
    editAccountId,
    editStorageUnitId: editAccountId ? editStorageUnitId : '',
    editState,
    editHoldDays: editState === 'tradeable' ? '' : editHoldDays,
  };
}

function getEmptyPreferences(): ManualOwnershipPreferences {
  return {
    editAccountId: '',
    editStorageUnitId: '',
    editState: 'tradeable',
    editHoldDays: '',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readTradeState(value: unknown): ItemTradeState | null {
  return value === 'tradeable' || value === 'hold' || value === 'protected' ? value : null;
}
