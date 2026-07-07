import type { ScanResultItem } from './types';
import { getScanResultItemGroupKey, getScanResultItemRowId } from './utils';

export function remapScannerRowSelection(
  selection: Record<string, boolean>,
  currentRows: ScanResultItem[],
  nextRows: ScanResultItem[]
): Record<string, boolean> {
  const selectedUnderlyingIds = new Set<string>();
  const currentRowsMap = new Map(currentRows.map((row) => [getScanResultItemRowId(row), row]));

  for (const [rowId, isSelected] of Object.entries(selection)) {
    if (!isSelected) continue;

    const row = currentRowsMap.get(rowId);
    if (row) {
      const ids = row.underlyingIds || [rowId];
      ids.forEach((id) => selectedUnderlyingIds.add(id));
    } else {
      selectedUnderlyingIds.add(rowId);
    }
  }

  const nextSelection: Record<string, boolean> = {};
  for (const row of nextRows) {
    const rowId = getScanResultItemRowId(row);
    const ids = row.underlyingIds || [rowId];
    if (ids.some((id) => selectedUnderlyingIds.has(id))) {
      nextSelection[rowId] = true;
    }
  }

  return nextSelection;
}

export function getSelectedScannerRows(
  rows: ScanResultItem[],
  selection: Record<string, boolean>
): ScanResultItem[] {
  return rows.filter((item) => selection[getScanResultItemRowId(item)]);
}

export function findScannerRowByRowId(
  rows: ScanResultItem[],
  targetItem: ScanResultItem
): ScanResultItem | undefined {
  const targetId = getScanResultItemRowId(targetItem);
  return rows.find((item) => getScanResultItemRowId(item) === targetId);
}

export function getScannerGroupRows(
  rows: ScanResultItem[],
  targetItem: ScanResultItem
): ScanResultItem[] {
  const targetGroupKey = getScanResultItemGroupKey(targetItem);
  return rows.filter((item) => getScanResultItemGroupKey(item) === targetGroupKey);
}

export function getScannerGroupSelection(
  rows: ScanResultItem[],
  targetItem: ScanResultItem
): Record<string, boolean> {
  return getScannerGroupRows(rows, targetItem).reduce<Record<string, boolean>>((selection, row) => {
    selection[getScanResultItemRowId(row)] = true;
    return selection;
  }, {});
}
