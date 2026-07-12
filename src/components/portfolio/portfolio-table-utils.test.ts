import { describe, expect, it } from 'vitest';
import type { PortfolioTableRow } from './portfolio-table-model';
import { getFilteredRowsChangeKey } from './portfolio-table-utils';

describe('getFilteredRowsChangeKey', () => {
  it('stays stable for cloned rows with the same summary values', () => {
    const row = createRow();

    expect(getFilteredRowsChangeKey([row])).toBe(
      getFilteredRowsChangeKey([{ ...row, itemIds: [...row.itemIds] }])
    );
  });

  it('changes when filtering or account-scoped values change', () => {
    const first = createRow();
    const changedQuantity = { ...first, quantity: 2, currentValue: 200 };

    expect(getFilteredRowsChangeKey([first])).not.toBe(getFilteredRowsChangeKey([changedQuantity]));
    expect(getFilteredRowsChangeKey([first])).not.toBe(getFilteredRowsChangeKey([]));
  });
});

function createRow(): PortfolioTableRow {
  return {
    id: 'row-1',
    itemIds: ['item-1'],
    itemType: 'case',
    quantity: 1,
    storageUnitQuantity: 0,
    investedValue: 50,
    currentValue: 100,
    currentPrice: 100,
    steamPrice: 100,
  } as PortfolioTableRow;
}
