import type { CaseDto, PortfolioReportDto, PortfolioReportRowDto } from '@/types/report';
import { estimateOverpay } from '@/services/pattern/overpay-calculator';
import { buildItemVariantKey } from '@/utils/item-identity';
import type {
  PortfolioRowItemType,
  PortfolioSourceAccount,
  PortfolioTableMode,
  PortfolioTableRow,
} from './portfolio-table-types';

export type {
  PortfolioItemTypeFilter,
  PortfolioRowItemType,
  PortfolioRowSourceType,
  PortfolioSourceAccount,
  PortfolioSourceFilter,
  PortfolioTableMode,
  PortfolioTableRow,
} from './portfolio-table-types';
export { getItemStatusBreakdown } from './portfolio-table-status';

export function buildPortfolioTableRows(
  report: PortfolioReportDto,
  mode: PortfolioTableMode,
  buffPricesCny?: Record<string, number>,
  buffCnyToVndRate?: number
): PortfolioTableRow[] {
  return mode === 'transactions'
    ? report.rows
        .map((row) => mapTransactionRow(row, buffPricesCny, buffCnyToVndRate))
        .sort(compareManualRowsFirst)
    : buildCaseSummaryRows(report.rows, buffPricesCny, buffCnyToVndRate).sort(
        compareManualRowsFirst
      );
}

export function remapPortfolioRowSelection(
  selection: Record<string, boolean>,
  currentRows: PortfolioTableRow[],
  nextRows: PortfolioTableRow[]
): Record<string, boolean> {
  // Giữ lựa chọn khi đổi mode bằng cách theo dõi ID vật phẩm gốc, không dùng row ID dễ thay đổi.
  const selectedItemIds = new Set<string>();
  const currentRowsById = new Map(currentRows.map((row) => [row.id, row]));

  for (const [rowId, isSelected] of Object.entries(selection)) {
    if (!isSelected) continue;

    const row = currentRowsById.get(rowId);
    if (row) {
      row.itemIds.forEach((itemId) => selectedItemIds.add(itemId));
    } else {
      selectedItemIds.add(rowId);
    }
  }

  const nextSelection: Record<string, boolean> = {};
  for (const row of nextRows) {
    if (row.itemIds.some((itemId) => selectedItemIds.has(itemId))) {
      nextSelection[row.id] = true;
    }
  }

  return nextSelection;
}

export function mapTransactionRow(
  row: PortfolioReportRowDto,
  buffPricesCny?: Record<string, number>,
  buffCnyToVndRate?: number
): PortfolioTableRow {
  let currentPrice = row.currentPrice;
  let currentValue = row.currentValue;
  let profitAmount = row.profitAmount;
  let profitPercent = row.profitPercent;

  const isStorageUnitLot = Boolean(row.item.storageUnitId);
  const lotQty = isStorageUnitLot ? 0 : row.item.quantity;
  const totalQuantity = lotQty + (row.item.storageUnitQuantity ?? 0);
  const marketHashName = row.case.marketHashName;
  const buffPriceCny = buffPricesCny ? buffPricesCny[marketHashName] : undefined;

  // Ghi đè BUFF thay thế giá Steam nhưng vẫn cộng phần phụ trội sticker lên giá skin gốc.
  const overpayInfo =
    row.item.patternInfo && buffPriceCny !== undefined && buffPriceCny > 0
      ? estimateOverpay(row.item.patternInfo, buffPriceCny)
      : null;
  const stickerCurrentAdd =
    row.currentPrice !== null && row.skinCurrentPrice !== undefined && row.skinCurrentPrice !== null
      ? Math.max(0, row.currentPrice - row.skinCurrentPrice)
      : 0;

  if (buffPriceCny !== undefined && buffPriceCny > 0 && buffCnyToVndRate !== undefined) {
    const finalCny = overpayInfo ? overpayInfo.estimatedTypical : buffPriceCny;
    const buffVnd = Math.round(finalCny * buffCnyToVndRate) + stickerCurrentAdd;
    currentPrice = buffVnd;
    currentValue = buffVnd * totalQuantity;
    profitAmount = currentValue - row.investedValue;
    profitPercent = row.investedValue > 0 ? (profitAmount / row.investedValue) * 100 : 0;
  }

  return {
    id: row.item.id,
    mode: 'transactions',
    case: row.case,
    itemIds: [row.item.id],
    quantity: totalQuantity,
    lotCount: 1,
    buyPrice: row.item.buyPrice,
    buyDate: row.item.buyDate,
    createdAt: row.item.createdAt,
    note: row.item.note,
    sourceType: isManualReportRow(row) ? 'manual' : 'existing',
    itemType: inferItemType(row.case),
    sourceAccounts: isStorageUnitLot ? [] : (row.item.sourceAccounts ?? []),
    currentPrice,
    steamPrice: row.skinCurrentPrice ?? row.currentPrice,
    skinCurrentPrice: row.skinCurrentPrice ?? row.currentPrice,
    currentPriceCapturedAt: row.currentPriceCapturedAt,
    investedValue: row.investedValue,
    currentValue,
    profitAmount,
    profitPercent,
    marketChanges: row.marketChanges,
    tradeHoldUntil: row.item.tradeHoldUntil ?? null,
    isTemporaryPrice: row.item.isTemporaryPrice,
    storageUnitId: row.item.storageUnitId,
    storageUnitQuantity: row.item.storageUnitQuantity,
    storageUnitDetails: row.item.storageUnitDetails,
    dopplerPhase: row.item.dopplerPhase,
    inspectLink: row.item.inspectLink,
    patternInfo: row.item.patternInfo,
    stickerPriceRate: row.item.stickerPriceRate,
    stickerPriceAdd: row.item.stickerPriceAdd,
    stickerBuyPriceRate: row.item.stickerBuyPriceRate,
    stickerBuyPriceAdd: row.item.stickerBuyPriceAdd,
    stickerScanTotalPrice: row.item.stickerScanTotalPrice,
    stickerScanPriceCapturedAt: row.item.stickerScanPriceCapturedAt,
  };
}

function buildCaseSummaryRows(
  rows: PortfolioReportRowDto[],
  buffPricesCny?: Record<string, number>,
  buffCnyToVndRate?: number
): PortfolioTableRow[] {
  const groupedRows = new Map<string, PortfolioReportRowDto[]>();

  for (const row of rows) {
    // Chế độ summary chỉ gom theo case và phase; biến thể inspect/pattern lẫn nhau sẽ được đánh dấu sau.
    const key = `${row.case.id}:${row.item.dopplerPhase ?? 'normal'}`;
    const currentRows = groupedRows.get(key) ?? [];
    currentRows.push(row);
    groupedRows.set(key, currentRows);
  }

  return Array.from(groupedRows.values()).map((r) =>
    mapCaseSummaryRow(r, buffPricesCny, buffCnyToVndRate)
  );
}

function mapCaseSummaryRow(
  rows: PortfolioReportRowDto[],
  buffPricesCny?: Record<string, number>,
  buffCnyToVndRate?: number
): PortfolioTableRow {
  const [firstRow] = rows;
  const inventoryQuantity = rows.reduce(
    (sum, row) => sum + (row.item.storageUnitId ? 0 : row.item.quantity),
    0
  );
  const storageUnitQuantity = rows.reduce(
    (sum, row) => sum + (row.item.storageUnitQuantity ?? 0),
    0
  );
  const totalQuantity = inventoryQuantity + storageUnitQuantity;
  const investedValue = rows.reduce((sum, row) => sum + row.investedValue, 0);

  let totalCurrentValue = 0;
  let hasNullPrice = false;
  let representativePrice = firstRow.currentPrice;
  const variantKeys = new Set(
    rows.map((row) =>
      buildItemVariantKey({
        caseId: row.case.id,
        dopplerPhase: row.item.dopplerPhase,
        inspectLink: row.item.inspectLink,
        patternInfo: row.item.patternInfo,
      })
    )
  );
  const hasMixedVariants = variantKeys.size > 1;

  for (const row of rows) {
    const itemBuffPriceCny = buffPricesCny ? buffPricesCny[row.case.marketHashName] : undefined;
    let itemPriceVnd = row.currentPrice;
    const stickerCurrentAdd =
      row.currentPrice !== null &&
      row.skinCurrentPrice !== undefined &&
      row.skinCurrentPrice !== null
        ? Math.max(0, row.currentPrice - row.skinCurrentPrice)
        : 0;

    if (itemBuffPriceCny !== undefined && itemBuffPriceCny > 0 && buffCnyToVndRate !== undefined) {
      let finalCny = itemBuffPriceCny;
      if (row.item.patternInfo) {
        const overpay = estimateOverpay(row.item.patternInfo, itemBuffPriceCny);
        if (overpay) {
          finalCny = overpay.estimatedTypical;
        }
      }
      itemPriceVnd = Math.round(finalCny * buffCnyToVndRate) + stickerCurrentAdd;
    }

    if (itemPriceVnd === null) {
      // Chỉ một giá không rõ cũng làm tổng giá trị hiện tại thành không rõ thay vì tính một phần.
      hasNullPrice = true;
    } else {
      const qty =
        (row.item.storageUnitId ? 0 : row.item.quantity) + (row.item.storageUnitQuantity ?? 0);
      totalCurrentValue += itemPriceVnd * qty;
      representativePrice = itemPriceVnd;
    }
  }

  const currentValue = hasNullPrice ? null : totalCurrentValue;
  if (currentValue !== null && totalQuantity > 0) {
    representativePrice = Math.round(currentValue / totalQuantity);
  }
  const profitAmount = currentValue === null ? null : currentValue - investedValue;

  return {
    id: `case-${firstRow.case.id}-${firstRow.item.dopplerPhase ?? 'normal'}`,
    mode: 'case-summary',
    case: firstRow.case,
    itemIds: rows.map((row) => row.item.id),
    quantity: totalQuantity,
    lotCount: rows.length,
    buyPrice: totalQuantity > 0 ? investedValue / totalQuantity : 0,
    buyDate: getDateRangeLabel(rows.map((row) => row.item.buyDate)),
    createdAt: getLatestDate(rows.map((row) => row.item.createdAt)),
    sourceType: rows.some(isManualReportRow) ? 'manual' : 'existing',
    itemType: inferItemType(firstRow.case),
    sourceAccounts: mergeSourceAccounts(
      rows.flatMap((row) => (row.item.storageUnitId ? [] : (row.item.sourceAccounts ?? [])))
    ),
    currentPrice: representativePrice,
    steamPrice: firstRow.skinCurrentPrice ?? firstRow.currentPrice,
    skinCurrentPrice: firstRow.skinCurrentPrice ?? firstRow.currentPrice,
    currentPriceCapturedAt: firstRow.currentPriceCapturedAt,
    investedValue,
    currentValue,
    profitAmount,
    profitPercent:
      profitAmount === null || investedValue <= 0 ? null : (profitAmount / investedValue) * 100,
    note: rows.some(isManualReportRow) ? 'Manual' : 'Imported from inventory scanner',
    marketChanges: firstRow.marketChanges,
    tradeHoldUntil: getLatestDate(
      rows
        .map((row) => row.item.tradeHoldUntil)
        .filter((val): val is string => typeof val === 'string')
    ),
    isTemporaryPrice: rows.some((row) => row.item.isTemporaryPrice),
    storageUnitQuantity,
    storageUnitDetails: mergeStorageUnitDetails(
      rows.flatMap((r) => r.item.storageUnitDetails ?? [])
    ),
    dopplerPhase: firstRow.item.dopplerPhase,
    // Tránh hiển thị trường inspect/pattern theo asset khi summary chứa biến thể lẫn nhau.
    inspectLink: hasMixedVariants ? undefined : firstRow.item.inspectLink,
    patternInfo: hasMixedVariants ? undefined : firstRow.item.patternInfo,
    stickerPriceRate: hasMixedVariants ? undefined : firstRow.item.stickerPriceRate,
    stickerPriceAdd: hasMixedVariants ? undefined : firstRow.item.stickerPriceAdd,
    stickerBuyPriceRate: hasMixedVariants ? undefined : firstRow.item.stickerBuyPriceRate,
    stickerBuyPriceAdd: hasMixedVariants ? undefined : firstRow.item.stickerBuyPriceAdd,
    stickerScanTotalPrice: hasMixedVariants ? undefined : firstRow.item.stickerScanTotalPrice,
    stickerScanPriceCapturedAt: hasMixedVariants
      ? undefined
      : firstRow.item.stickerScanPriceCapturedAt,
    hasMixedVariants,
    variantCount: variantKeys.size,
  };
}

function mergeStorageUnitDetails(
  details: Array<{
    storageUnitId: string;
    storageUnitName: string;
    quantity: number;
    steamId64?: string;
  }>
) {
  const map = new Map<
    string,
    { storageUnitId: string; storageUnitName: string; quantity: number; steamId64?: string }
  >();
  for (const d of details) {
    const existing = map.get(d.storageUnitId);
    if (existing) {
      existing.quantity += d.quantity;
    } else {
      map.set(d.storageUnitId, { ...d });
    }
  }
  return Array.from(map.values());
}

function compareManualRowsFirst(first: PortfolioTableRow, second: PortfolioTableRow): number {
  const firstManual = isManualTableRow(first);
  const secondManual = isManualTableRow(second);

  if (firstManual !== secondManual) {
    return firstManual ? -1 : 1;
  }

  return getDateSortValue(second.createdAt) - getDateSortValue(first.createdAt);
}

function isManualTableRow(row: PortfolioTableRow): boolean {
  return !isInventoryImportNote(row.note);
}

function isManualReportRow(row: PortfolioReportRowDto): boolean {
  return !isInventoryImportNote(row.item.note);
}

function isInventoryImportNote(note: string | undefined): boolean {
  if (!note) return false;
  const n = note.toLowerCase();
  return (
    n.includes('inventory scanner') || n.includes('lịch sử trade') || n.includes('trade history')
  );
}

function inferItemType(caseItem: CaseDto): PortfolioRowItemType {
  const value = `${caseItem.name} ${caseItem.marketHashName}`.toLowerCase();
  if (value.includes('capsule') || value.includes('package')) return 'capsule';
  if (value.startsWith('sticker |')) return 'sticker';
  if (value.startsWith('sealed graffiti |') || value.startsWith('graffiti |')) return 'graffiti';
  if (value.startsWith('music kit |')) return 'music_kit';
  if (value.startsWith('patch |')) return 'patch';
  if (value.startsWith('pin |') || value.startsWith('collectible pin')) return 'pin';
  if (value.startsWith('charm |')) return 'charm';

  // Nhận diện Agent
  if (
    value.startsWith('agent |') ||
    value.includes('biệt kích') ||
    value.includes('agent') ||
    value.includes(' | ksk') ||
    value.includes(' | fbi') ||
    value.includes(' | swat') ||
    value.includes(' | sas') ||
    value.includes(' | nswc') ||
    value.includes(' | elite crew') ||
    value.includes(' | phoenix') ||
    value.includes(' | sabre') ||
    value.includes(' | gendarmerie') ||
    value.includes(' | guerilla')
  ) {
    return 'agent';
  }

  if (value.includes(' | ')) return 'skin';
  return 'case';
}

function mergeSourceAccounts(accounts: PortfolioSourceAccount[]): PortfolioSourceAccount[] {
  const map = new Map<string, PortfolioSourceAccount>();
  for (const account of accounts) {
    const existing = map.get(account.steamId64);
    if (existing) {
      if (account.breakdown) {
        if (!existing.breakdown) {
          existing.breakdown = {
            tradeable: 0,
            onMarket: 0,
            tradeProtected: 0,
            hold: 0,
          };
        }
        existing.breakdown.tradeable =
          (existing.breakdown.tradeable ?? 0) + (account.breakdown.tradeable ?? 0);
        existing.breakdown.onMarket =
          (existing.breakdown.onMarket ?? 0) + (account.breakdown.onMarket ?? 0);
        existing.breakdown.tradeProtected =
          (existing.breakdown.tradeProtected ?? 0) + (account.breakdown.tradeProtected ?? 0);
        existing.breakdown.hold = (existing.breakdown.hold ?? 0) + (account.breakdown.hold ?? 0);
      }
    } else {
      map.set(account.steamId64, {
        ...account,
        breakdown: account.breakdown ? { ...account.breakdown } : undefined,
      });
    }
  }
  return Array.from(map.values());
}

function getDateRangeLabel(values: string[]): string | null {
  const timestamps = values
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((first, second) => first - second);

  if (timestamps.length === 0) {
    return null;
  }

  const first = new Date(timestamps[0]).toISOString();
  const last = new Date(timestamps[timestamps.length - 1]).toISOString();
  return first === last ? first : `${first}|${last}`;
}

function getLatestDate(values: string[]): string | null {
  const timestamps = values
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((first, second) => second - first);

  return timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : null;
}

function getDateSortValue(value: string | null): number {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getRowSubtype(row: {
  case: { name: string; marketHashName: string };
  itemType: string;
}): string {
  if (row.itemType !== 'skin') {
    if (row.itemType === 'case') return 'Case';
    if (row.itemType === 'capsule') return 'Capsule';
    if (row.itemType === 'sticker') return 'Sticker';
    if (row.itemType === 'agent') return 'Agent';
    if (row.itemType === 'music_kit') return 'Music Kit';
    if (row.itemType === 'pin') return 'Pin';
    if (row.itemType === 'patch') return 'Patch';
    if (row.itemType === 'graffiti') return 'Graffiti';
    if (row.itemType === 'charm') return 'Charm';
    return row.itemType;
  }

  const name = row.case.name;
  const hashName = row.case.marketHashName;
  const lowerName = name.toLowerCase();

  // Nhận diện găng trước
  if (
    lowerName.includes('gloves') ||
    lowerName.includes('wraps') ||
    lowerName.includes('hand wraps')
  ) {
    return 'Gloves';
  }
  // Nhận diện dao
  if (
    lowerName.includes('knife') ||
    lowerName.includes('bayonet') ||
    lowerName.includes('karambit') ||
    lowerName.includes('daggers') ||
    lowerName.includes('kukri') ||
    lowerName.includes('stiletto') ||
    lowerName.includes('talon') ||
    lowerName.includes('ursus') ||
    lowerName.includes('navaja') ||
    lowerName.includes('bowie') ||
    lowerName.includes('huntsman') ||
    lowerName.includes('falchion') ||
    lowerName.includes('butcher') ||
    hashName.startsWith('★ ')
  ) {
    return 'Knives';
  }
  // Nhận diện Agent
  if (
    lowerName.startsWith('agent |') ||
    lowerName.includes('biệt kích') ||
    lowerName.includes('agent') ||
    lowerName.includes(' | ksk') ||
    lowerName.includes(' | fbi') ||
    lowerName.includes(' | swat') ||
    lowerName.includes(' | sas') ||
    lowerName.includes(' | nswc') ||
    lowerName.includes(' | elite crew') ||
    lowerName.includes(' | phoenix') ||
    lowerName.includes(' | sabre') ||
    lowerName.includes(' | gendarmerie') ||
    lowerName.includes(' | guerilla')
  ) {
    return 'Agent';
  }
  // Nhận diện Music Kit
  if (lowerName.includes('music kit')) {
    return 'Music Kit';
  }
  // Nhận diện patch, pin, graffiti, v.v.
  if (lowerName.startsWith('patch |')) {
    return 'Patch';
  }
  if (lowerName.startsWith('pin |')) {
    return 'Pin';
  }
  if (lowerName.startsWith('graffiti |')) {
    return 'Graffiti';
  }

  // Nếu không thì đây là skin vũ khí. Trích tên vũ khí trước " | "
  const parts = name.split(' | ');
  if (parts.length > 0) {
    let weapon = parts[0].trim();
    // Bỏ tiền tố ★ để phòng trường hợp còn sót
    if (weapon.startsWith('★ ')) {
      weapon = weapon.slice(2).trim();
    }
    return weapon;
  }

  return 'Other Skins';
}
