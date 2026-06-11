import { resolveCaseItem } from "./item-resolver";
import type { ParsedItem, ParsedItemCandidate } from "./types";

export function parseItemRate(text: string): number | null {
  return parseRate(
    text.match(/\brate\s*[:=]?\s*([0-9]*[.,][0-9]+|[0-9]+)/i)?.[1] ?? null,
  );
}

export function parseAllRate(text: string): number | null {
  return parseRate(
    text.match(/\ball\s*[:=]?\s*([0-9]*[.,][0-9]+|[0-9]+)/i)?.[1] ??
      text.match(/\bcâm\s*[:=]?\s*([0-9]*[.,][0-9]+|[0-9]+)/i)?.[1] ??
      text.match(/\ball\b[^\r\n]{0,40}?([0-9]*[.,][0-9]+|[0-9]+)/i)?.[1] ??
      text.match(/\bkho\s*[:=]?\s*([0-9]*[.,][0-9]+|[0-9]+)/i)?.[1] ??
      null,
  );
}

export function parseRate(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseItems(text: string): ParsedItem[] {
  return text
    .split(/\r?\n/)
    .map((line) => parseItemLine(line))
    .filter((item): item is ParsedItem => Boolean(item));
}

export function parseItemLine(line: string): ParsedItem | null {
  const normalizedLine = normalizePostLine(line);
  if (!normalizedLine) {
    return null;
  }

  const candidate =
    parsePrefixedQuantity(normalizedLine) ??
    parseSuffixedQuantity(normalizedLine) ??
    parseQuantityWithUnit(normalizedLine) ??
    parseSimpleQuantityAndName(normalizedLine);

  if (!candidate) {
    const inputName = parseImplicitSingleItem(normalizedLine);
    return inputName ? { quantity: 1, inputName } : null;
  }

  if (!Number.isFinite(candidate.quantity) || candidate.quantity <= 0) {
    return null;
  }

  const inputName = cleanupInputName(candidate.rawName);
  if (!inputName) {
    return null;
  }

  return {
    quantity: candidate.quantity,
    inputName,
  };
}

export function normalizePostLine(value: string): string {
  return normalizeForParsing(value)
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\brate\s*[:=]?\s*[0-9]+(?:[.,][0-9]+)?.*$/i, " ")
    .replace(/\ball\s*[:=]?\s*[0-9]+(?:[.,][0-9]+)?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parsePrefixedQuantity(line: string): ParsedItemCandidate | null {
  const match =
    line.match(/(?:^|\s)[x×]\s*(\d+)\s+(.+)$/i) ??
    line.match(/(?:^|\s)(\d+)\s*[x×]\s+(.+)$/i);
  return match ? { quantity: Number(match[1]), rawName: match[2] } : null;
}

export function parseSuffixedQuantity(line: string): ParsedItemCandidate | null {
  const match = line.match(/^(.+?)\s+[x×]\s*(\d+)$/i);
  return match ? { quantity: Number(match[2]), rawName: match[1] } : null;
}

export function parseQuantityWithUnit(line: string): ParsedItemCandidate | null {
  const match = line.match(
    /(?:^|\s)(\d+)\s+(?:hom|case|cases|thung|hop)\s+(.+)$/i,
  );
  return match ? { quantity: Number(match[1]), rawName: match[2] } : null;
}

export function parseSimpleQuantityAndName(line: string): ParsedItemCandidate | null {
  const match = line.match(/(?:^|\s)(\d+)\s+(.+)$/i);
  if (match) {
    const qty = Number(match[1]);
    const rawName = match[2].trim();
    const cleaned = cleanupInputName(rawName);
    if (resolveCaseItem(cleaned)) {
      return { quantity: qty, rawName };
    }
  }
  return null;
}

export function parseImplicitSingleItem(line: string): string | null {
  const inputName = cleanupInputName(
    line.replace(/^(?:hom|case|cases|thung|hop)\s+/i, ""),
  );
  return inputName && resolveCaseItem(inputName) ? inputName : null;
}

export function cleanupInputName(value: string): string {
  return value
    .replace(/\b(rate|all)\b.*$/i, "")
    .replace(
      /\b(a|ban|bai|bay|can|e|em|hom|hop|hòm|ib|inbox|inv|inventory|lai|laptop|link|nha|nhe|post|thung|xa)\b/gi,
      " ",
    )
    .replace(/[.,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeForParsing(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  return parseRate(value.match(/[0-9]+(?:[.,][0-9]+)?/)?.[0] ?? null);
}
