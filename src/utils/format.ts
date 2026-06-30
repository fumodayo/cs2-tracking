export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }

  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }

  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

export { formatDateTimeVi as formatDateTime, formatInputDate } from '@/utils/date';

export function formatVND(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);
}

// Định dạng số nguyên với dấu chấm phân cách hàng nghìn (chuẩn VN) dành cho thẻ Input
export const formatIntegerViInput = (val: string | number): string => {
  let str = '';
  if (typeof val === 'number') {
    str = Math.round(val).toString();
  } else {
    str = String(val).replace(/\D/g, '');
  }
  if (!str) return '';
  return Number(str).toLocaleString('vi-VN');
};

// Định dạng số thập phân với dấu chấm phân cách hàng nghìn và dấu phẩy phân cách phần thập phân (chuẩn VN) dành cho thẻ Input
export const formatDecimalViInput = (val: string | number): string => {
  let str = '';
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      str = val.toString();
    } else {
      str = val
        .toFixed(1)
        .replace(/\.?0+$/, '')
        .replace('.', ',');
    }
  } else {
    str = String(val);
  }

  if (str.endsWith('.')) {
    str = str.slice(0, -1) + ',';
  }

  let clean = str.replace(/\./g, '');
  clean = clean.replace(/[^0-9,]/g, '');

  const commaIndex = clean.indexOf(',');
  let integerPart = '';
  let decimalPart = '';
  let hasComma = false;

  if (commaIndex !== -1) {
    hasComma = true;
    integerPart = clean.substring(0, commaIndex);
    decimalPart = clean.substring(commaIndex + 1).replace(/,/g, '');
  } else {
    integerPart = clean;
  }

  if (!integerPart && !decimalPart && !hasComma) return '';

  const formattedInteger = integerPart ? Number(integerPart).toLocaleString('vi-VN') : '';
  return hasComma ? `${formattedInteger},${decimalPart}` : formattedInteger;
};

// Chuyển đổi chuỗi định dạng VN thành số thực Javascript để tính toán
export const parseViFloat = (val: string): number => {
  const normalized = val.replace(/\./g, '').replace(/,/g, '.');
  return parseFloat(normalized);
};
