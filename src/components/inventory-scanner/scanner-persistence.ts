'use client';

import { readAsyncJson, writeAsyncJson } from '@/lib/async-json-storage';
import type { AccountEntry, ScanResultItem } from './types';
import { LS_ACCOUNTS, LS_MANUAL_ITEMS } from './utils';

const ASYNC_ACCOUNTS_KEY = 'inventory-scanner:accounts';
const ASYNC_MANUAL_ITEMS_KEY = 'inventory-scanner:manual-items';

type ScannerPersistedState = {
  accounts: AccountEntry[] | null;
  manualItems: ScanResultItem[] | null;
};

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined';
}

function canUseIndexedDb(): boolean {
  return canUseBrowserStorage() && 'indexedDB' in window;
}

function readLegacyJson<T>(key: string): T | null {
  if (!canUseBrowserStorage()) return null;

  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readWithLegacyMigration<T>(asyncKey: string, legacyKey: string): Promise<T | null> {
  if (!canUseBrowserStorage()) return null;

  if (canUseIndexedDb()) {
    try {
      const asyncValue = await readAsyncJson<T>(asyncKey);
      if (asyncValue) return asyncValue;
    } catch (error) {
      console.error(`Failed to read ${asyncKey} from IndexedDB:`, error);
    }
  }

  const legacyValue = readLegacyJson<T>(legacyKey);
  if (!legacyValue) return null;

  if (canUseIndexedDb()) {
    try {
      await writeAsyncJson(asyncKey, legacyValue);
      window.localStorage.removeItem(legacyKey);
    } catch (error) {
      console.error(`Failed to migrate ${legacyKey} to IndexedDB:`, error);
    }
  }

  return legacyValue;
}

async function writePersistedValue<T>(
  asyncKey: string,
  legacyKey: string,
  value: T
): Promise<void> {
  if (!canUseBrowserStorage()) return;

  if (canUseIndexedDb()) {
    try {
      await writeAsyncJson(asyncKey, value);
      window.localStorage.removeItem(legacyKey);
      return;
    } catch (error) {
      console.error(`Failed to persist ${asyncKey} to IndexedDB:`, error);
    }
  }

  window.localStorage.setItem(legacyKey, JSON.stringify(value));
}

export async function loadScannerPersistedState(): Promise<ScannerPersistedState> {
  const [accounts, manualItems] = await Promise.all([
    readWithLegacyMigration<AccountEntry[]>(ASYNC_ACCOUNTS_KEY, LS_ACCOUNTS),
    readWithLegacyMigration<ScanResultItem[]>(ASYNC_MANUAL_ITEMS_KEY, LS_MANUAL_ITEMS),
  ]);

  return {
    accounts,
    manualItems,
  };
}

export function persistScannerAccounts(accounts: AccountEntry[]): Promise<void> {
  return writePersistedValue(ASYNC_ACCOUNTS_KEY, LS_ACCOUNTS, accounts);
}

export function persistScannerManualItems(manualItems: ScanResultItem[]): Promise<void> {
  return writePersistedValue(ASYNC_MANUAL_ITEMS_KEY, LS_MANUAL_ITEMS, manualItems);
}
