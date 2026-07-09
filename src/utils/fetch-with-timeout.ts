/**
 *
 *
 * Hàm bọc fetch HTTP chuẩn có cơ chế timeout.
 * Hỗ trợ cả môi trường trình duyệt và Node.js.
 *
 * @param input URL mục tiêu hoặc đối tượng Request của request
 * @param init Tùy chọn Fetch chuẩn
 * @param timeoutMs Timeout theo mili giây, mặc định 8000ms
 * @param customErrorMessage Message lỗi tùy chỉnh được ném khi request timeout
 *
 *
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 8000,
  customErrorMessage?: string
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(customErrorMessage || 'Network request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
