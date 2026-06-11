import type { CaseItem } from "@/domain/case-item";

export type ParsedItem = {
  inputName: string;
  quantity: number;
  originalName?: string;
};

export type PostAnalysisImageInput = {
  data: string;
  mimeType: string;
};

export type ParsedItemCandidate = {
  rawName: string;
  quantity: number;
};

export type ResolvedItem = ParsedItem & {
  caseItem: Omit<CaseItem, "id" | "isActive">;
};

export type ItemResolution = {
  resolvedItems: ResolvedItem[];
  unknownItems: ParsedItem[];
};

export type GeminiParsedPost = {
  itemRate: number | null;
  allRate: number | null;
  items: ParsedItem[];
};

export type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

export class GeminiImageRecognitionError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "GeminiImageRecognitionError";
  }
}

export const DEFAULT_ITEM_RATE = 1;
export const PRICE_LOOKUP_CONCURRENCY = 4;
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
export const GEMINI_TIMEOUT_MS = 8000;
export const GEMINI_IMAGE_TIMEOUT_MS = 15000;
