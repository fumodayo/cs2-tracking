import type { PortfolioSourceFilter } from '../portfolio-table-model';

export const FILTER_PARAM_KEYS = {
  search: 'q',
  source: 'source',
  itemType: 'itemType',
  account: 'account',
  status: 'status',
  priceSource: 'priceSource',
} as const;

export type PortfolioFilterUrlState = {
  globalFilter: string;
  sourceFilters: PortfolioSourceFilter[];
  itemTypeFilters: string[];
  accountFilters: string[];
  statusFilters: string[];
  priceSourceFilters: string[];
};

export function buildPortfolioFilterQueryString(
  currentSearch: string,
  state: PortfolioFilterUrlState
): string {
  const params = new URLSearchParams(currentSearch);
  const trimmedGlobalFilter = state.globalFilter.trim();

  if (trimmedGlobalFilter) {
    params.set(FILTER_PARAM_KEYS.search, trimmedGlobalFilter);
  } else {
    params.delete(FILTER_PARAM_KEYS.search);
  }

  setParamList(params, FILTER_PARAM_KEYS.source, state.sourceFilters);
  setParamList(params, FILTER_PARAM_KEYS.itemType, state.itemTypeFilters);
  setParamList(params, FILTER_PARAM_KEYS.account, state.accountFilters);
  setParamList(params, FILTER_PARAM_KEYS.status, state.statusFilters);
  setParamList(params, FILTER_PARAM_KEYS.priceSource, state.priceSourceFilters);

  // Filter changes always reset pagination. One URL write prevents filter/page races.
  params.delete('page');

  return params.toString();
}

function setParamList(params: URLSearchParams, key: string, values: string[]) {
  params.delete(key);
  for (const value of values) {
    params.append(key, value);
  }
}
