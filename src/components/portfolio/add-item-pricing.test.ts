import { describe, expect, it } from 'vitest';
import { getSavedBuffPriceCny } from './add-item-pricing';

describe('getSavedBuffPriceCny', () => {
  it('treats items without a saved BUFF price as Market-priced items', () => {
    expect(getSavedBuffPriceCny('Kilowatt Case', {})).toBeNull();
  });

  it('returns a valid saved BUFF price', () => {
    expect(getSavedBuffPriceCny('AK-47 | Redline', { 'AK-47 | Redline': 88.5 })).toBe(88.5);
  });

  it('rejects invalid saved BUFF prices', () => {
    expect(getSavedBuffPriceCny('Item', { Item: 0 })).toBeNull();
    expect(getSavedBuffPriceCny('Item', { Item: Number.NaN })).toBeNull();
  });
});
