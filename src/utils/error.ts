import { NextResponse } from 'next/server';

export function getErrorMessage(error: unknown, fallback = 'An error occurred.'): string {
  return error instanceof Error ? error.message : fallback;
}

export enum ApiErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  BAD_REQUEST = 'BAD_REQUEST',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

export interface ApiErrorResponse {
  code: ApiErrorCode | string;
  message: string;
  details?: unknown;
}

/**
 * Tạo response lỗi API theo chuẩn chung.
 */
export function apiError(
  code: ApiErrorCode | string,
  message: string,
  status: number,
  details?: unknown
) {
  return NextResponse.json({ code, message, details }, { status });
}
