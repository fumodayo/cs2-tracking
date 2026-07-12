import { describe, expect, it } from 'vitest';
import { buildPortfolioFilterQueryString } from './portfolio-filter-url';

describe('buildPortfolioFilterQueryString', () => {
  it('updates all filters and resets pagination in one query string', () => {
    const result = buildPortfolioFilterQueryString('?page=4&view=compact&source=existing', {
      globalFilter: '  recoil  ',
      sourceFilters: ['manual'],
      itemTypeFilters: ['case', 'capsule'],
      accountFilters: ['steam-1'],
      statusFilters: ['tradeable'],
      priceSourceFilters: ['steam'],
    });
    const params = new URLSearchParams(result);

    expect(params.get('page')).toBeNull();
    expect(params.get('view')).toBe('compact');
    expect(params.get('q')).toBe('recoil');
    expect(params.getAll('source')).toEqual(['manual']);
    expect(params.getAll('itemType')).toEqual(['case', 'capsule']);
    expect(params.getAll('account')).toEqual(['steam-1']);
    expect(params.getAll('status')).toEqual(['tradeable']);
    expect(params.getAll('priceSource')).toEqual(['steam']);
  });

  it('removes empty filter parameters', () => {
    const result = buildPortfolioFilterQueryString(
      '?q=old&source=manual&itemType=case&account=steam-1&status=hold&priceSource=buff',
      {
        globalFilter: '',
        sourceFilters: [],
        itemTypeFilters: [],
        accountFilters: [],
        statusFilters: [],
        priceSourceFilters: [],
      }
    );

    expect(result).toBe('');
  });
});
