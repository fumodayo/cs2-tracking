import { describe, expect, it, vi } from 'vitest';

import type { ItemHoverCardFormValues } from './item-hover-card-form-values';
import {
  MANUAL_OWNERSHIP_PREFERENCES_KEY,
  applyManualOwnershipPreferences,
  readManualOwnershipPreferences,
  writeManualOwnershipPreferences,
} from './manual-ownership-preferences';

describe('manual ownership preferences', () => {
  it('round-trips the last successfully saved ownership values', () => {
    let savedValue: string | null = null;
    const storage = {
      getItem: vi.fn(() => savedValue),
      setItem: vi.fn((_key: string, value: string) => {
        savedValue = value;
      }),
    };
    const preferences = {
      editAccountId: '76561198000000000',
      editStorageUnitId: 'storage-1',
      editState: 'hold' as const,
      editHoldDays: '7',
    };

    writeManualOwnershipPreferences(storage, preferences);

    expect(storage.setItem).toHaveBeenCalledWith(
      MANUAL_OWNERSHIP_PREFERENCES_KEY,
      JSON.stringify(preferences)
    );
    expect(readManualOwnershipPreferences(storage)).toEqual(preferences);
  });

  it('applies saved values only to manually added items', () => {
    const defaults = createFormValues();
    const preferences = {
      editAccountId: 'account-2',
      editStorageUnitId: 'storage-2',
      editState: 'protected' as const,
      editHoldDays: '3',
    };

    expect(applyManualOwnershipPreferences(defaults, 'manual', preferences)).toEqual({
      ...defaults,
      ...preferences,
    });
    expect(applyManualOwnershipPreferences(defaults, 'existing', preferences)).toBe(defaults);
  });

  it('ignores malformed saved data and removes invalid dependent values', () => {
    expect(
      readManualOwnershipPreferences({
        getItem: () => '{not-json',
      })
    ).toBeNull();
    expect(
      readManualOwnershipPreferences({
        getItem: () =>
          JSON.stringify({
            editAccountId: '',
            editStorageUnitId: 'orphaned-storage',
            editState: 'tradeable',
            editHoldDays: '7',
          }),
      })
    ).toEqual({
      editAccountId: '',
      editStorageUnitId: '',
      editState: 'tradeable',
      editHoldDays: '',
    });
  });
});

function createFormValues(): ItemHoverCardFormValues {
  return {
    quantity: '1',
    priceCny: '100',
    buyRate: '50',
    priceVnd: '50',
    note: '',
    sellRate: '100',
    editAccountId: '',
    editStorageUnitId: '',
    editState: 'tradeable',
    editHoldDays: '',
    stickerRate: '0',
    stickerBuyRate: '0',
    capturedScanTotal: null,
    capturedScanDate: undefined,
  };
}
