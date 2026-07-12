import { describe, expect, it } from 'vitest';

import { applyPortfolioPaginationUpdate } from './use-portfolio-table-state';

describe('applyPortfolioPaginationUpdate', () => {
  it('resets to the first page when page size changes', () => {
    const result = applyPortfolioPaginationUpdate({ pageIndex: 4, pageSize: 10 }, (current) => ({
      ...current,
      pageIndex: 4,
      pageSize: 50,
    }));

    expect(result).toEqual({ pageIndex: 0, pageSize: 50 });
  });

  it('keeps normal page navigation unchanged', () => {
    const result = applyPortfolioPaginationUpdate({ pageIndex: 4, pageSize: 10 }, (current) => ({
      ...current,
      pageIndex: 2,
    }));

    expect(result).toEqual({ pageIndex: 2, pageSize: 10 });
  });
});
