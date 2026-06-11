export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
}

/**
 * Custom sleep helper that respects an AbortSignal.
 */
function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(signal.reason || new DOMException("Aborted", "AbortError"));
    }

    let onAbort: () => void;

    const timeoutId = setTimeout(() => {
      if (signal && onAbort) {
        signal.removeEventListener("abort", onAbort);
      }
      resolve();
    }, ms);

    onAbort = () => {
      clearTimeout(timeoutId);
      reject(signal?.reason || new DOMException("Aborted", "AbortError"));
    };

    if (signal) {
      signal.addEventListener("abort", onAbort);
    }
  });
}

/**
 * Fetch wrapper that automatically retries on network failures, timeouts,
 * or transient HTTP status codes (429, 503, 500) from Gemini API.
 */
export async function fetchWithRetry(
  url: string | URL,
  options: RequestInit & { timeoutMs?: number },
  retryOptions: RetryOptions = {},
): Promise<Response> {
  const maxRetries = retryOptions.maxRetries ?? 3;
  const initialDelayMs = retryOptions.initialDelayMs ?? 1500;
  const backoffFactor = retryOptions.backoffFactor ?? 2;
  const timeoutMs = options.timeoutMs ?? 15000;

  let attempt = 0;
  let delay = initialDelayMs;
  const callerSignal = options.signal;

  while (true) {
    attempt++;

    if (callerSignal?.aborted) {
      throw callerSignal.reason || new DOMException("Aborted", "AbortError");
    }

    const controller = new AbortController();
    let abortedByCaller = false;

    const onCallerAbort = () => {
      abortedByCaller = true;
      controller.abort(callerSignal?.reason);
    };

    if (callerSignal) {
      callerSignal.addEventListener("abort", onCallerAbort);
    }

    const timeoutId = setTimeout(() => {
      controller.abort("Timeout");
    }, timeoutMs);

    try {
      const fetchOptions = { ...options, signal: controller.signal };
      // Delete custom timeoutMs if any to avoid passing it to fetch
      delete fetchOptions.timeoutMs;

      const response = await fetch(url, fetchOptions);

      // Check if we should retry based on the HTTP status code
      // 429: Too Many Requests / Quota Limit
      // 503: Service Unavailable / High demand / Overloaded
      // 500: Internal Server Error (randomly happens on Gemini)
      const shouldRetryStatus =
        response.status === 429 ||
        response.status === 503 ||
        response.status === 500;

      if (shouldRetryStatus && attempt <= maxRetries) {
        console.warn(
          `[Gemini Retry] Call returned status ${response.status}. Retrying (attempt ${attempt}/${maxRetries}) in ${Math.round(delay)}ms...`,
        );
        await sleep(delay, callerSignal);
        delay *= backoffFactor;
        // Add a small jitter (+/- 10%) to prevent thundering herd
        delay += (Math.random() - 0.5) * 0.2 * delay;
        continue;
      }

      // If we got here, either it's successful, a non-retryable error, or we ran out of retries
      return response;
    } catch (error: any) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      const isAttemptTimeout =
        isAbort && controller.signal.aborted && !abortedByCaller;

      // If the parent/caller aborted the request, we must immediately propagate that abort
      if (callerSignal?.aborted || abortedByCaller) {
        throw callerSignal?.reason || error;
      }

      // If it's a timeout or a network connection error, we can retry
      const isNetworkError = error instanceof TypeError; // fetch throws TypeError on network errors
      const isRetryableError = isAttemptTimeout || isNetworkError;

      if (isRetryableError && attempt <= maxRetries) {
        console.warn(
          `[Gemini Retry] Call failed: ${error?.message || "Timeout"}. Retrying (attempt ${attempt}/${maxRetries}) in ${Math.round(delay)}ms...`,
        );
        await sleep(delay, callerSignal);
        delay *= backoffFactor;
        delay += (Math.random() - 0.5) * 0.2 * delay;
        continue;
      }

      // Re-throw the error if we cannot retry or have exhausted retries
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (callerSignal) {
        callerSignal.removeEventListener("abort", onCallerAbort);
      }
    }
  }
}
