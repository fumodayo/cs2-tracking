import { describe, expect, it } from 'vitest';
import { parseMatrixWithMapping, readExcelHeaders } from './portfolio-excel';

describe('portfolio CSV import helpers', () => {
  it('parses mapped CSV rows', () => {
    const rows = parseMatrixWithMapping(
      [
        ['Market Hash Name', 'Quantity', 'Buy Price', 'Buy Date', 'Note'],
        ['Revolution Case', '2', '1500', '2026-07-08', 'manual'],
      ],
      { name: 0, quantity: 1, buyPrice: 2, buyDate: 3, note: 4 },
      0
    );

    expect(rows).toEqual([
      {
        caseId: undefined,
        marketHashName: 'Revolution Case',
        quantity: 2,
        buyPrice: 1500,
        buyDate: '2026-07-08',
        note: 'manual',
      },
    ]);
  });

  it('reads quoted CSV headers and rows', async () => {
    const result = await readExcelHeaders(
      '"Market Hash Name",Quantity,"Buy Price"\n"Dreams & Nightmares Case",3,1200'
    );

    expect(result.headers).toEqual(['Market Hash Name', 'Quantity', 'Buy Price']);
    expect(result.matrix[1]).toEqual(['Dreams & Nightmares Case', '3', '1200']);
  });
});
