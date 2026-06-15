export function getErrorMessage(error: unknown, fallback = "Có lỗi xảy ra."): string {
  return error instanceof Error ? error.message : fallback;
}
