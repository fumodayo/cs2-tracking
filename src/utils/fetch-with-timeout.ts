/**
 * Standard HTTP fetch wrapper with a timeout mechanism.
 * Supported in both Browser and Node.js environments.
 *
 * @param input The request target URL or Request object
 * @param init Standard Fetch options
 * @param timeoutMs Timeout in milliseconds (defaults to 8000ms)
 * @param customErrorMessage Custom error message thrown when the request times out
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
