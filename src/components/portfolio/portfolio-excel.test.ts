import { describe, expect, it } from 'vitest';
import writeXlsxFile from 'write-excel-file/node';
import type { SheetData } from 'write-excel-file/node';
import {
  parseMatrixWithMapping,
  parsePortfolioExcelFile,
  readExcelHeaders,
} from './portfolio-excel';

async function createExcelFile(rows: SheetData, name = 'portfolio.xlsx'): Promise<File> {
  const buffer = await writeXlsxFile(rows).toBuffer();
  return new File([new Uint8Array(buffer)], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('portfolio Excel import helpers', () => {
  it('reads .xlsx headers and rows', async () => {
    const file = await createExcelFile([
      ['Market Hash Name', 'Quantity', 'Buy Price'],
      ['Dreams & Nightmares Case', 3, 1200],
    ]);

    const result = await readExcelHeaders(file);

    expect(result.headers).toEqual(['Market Hash Name', 'Quantity', 'Buy Price']);
    expect(result.matrix[1]).toEqual(['Dreams & Nightmares Case', 3, 1200]);
  });

  it('parses .xlsx portfolio rows', async () => {
    const file = await createExcelFile([
      ['Market Hash Name', 'Quantity', 'Buy Price', 'Buy Date'],
      ['Revolution Case', 2, 1500, '2026-07-08'],
    ]);

    await expect(parsePortfolioExcelFile(file)).resolves.toEqual([
      {
        caseId: undefined,
        marketHashName: 'Revolution Case',
        quantity: 2,
        buyPrice: 1500,
        buyDate: '2026-07-08',
        note: 'Imported from Excel',
      },
    ]);
  });

  it('parses mapped delimited text rows', () => {
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

  it('reads quoted delimited text headers and rows', async () => {
    const result = await readExcelHeaders(
      '"Market Hash Name",Quantity,"Buy Price"\n"Dreams & Nightmares Case",3,1200'
    );

    expect(result.headers).toEqual(['Market Hash Name', 'Quantity', 'Buy Price']);
    expect(result.matrix[1]).toEqual(['Dreams & Nightmares Case', '3', '1200']);
  });

  it('does not expose null-like header cells as selectable column names', async () => {
    const result = await readExcelHeaders(
      'null\tTên\tSố lượng\tGiá mua\n\tRevolution Case\t2\t1500'
    );

    expect(result.headers).toEqual(['', 'Tên', 'Số lượng', 'Giá mua']);
  });
});
