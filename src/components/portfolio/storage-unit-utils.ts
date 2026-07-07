import type { StorageUnitItem } from './storage-unit-panel';

export function getStorageUnitItemKey(item: Pick<StorageUnitItem, 'caseId' | 'marketHashName'>) {
  return item.caseId || item.marketHashName;
}
