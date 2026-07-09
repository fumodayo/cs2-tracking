export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
}

/**
 * Helper sleep tùy chỉnh có tôn trọng AbortSignal.
 */
function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    }

    const timeoutId = setTimeout(() => {
      if (signal && onAbort) {
        signal.removeEventListener('abort', onAbort);
      }
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeoutId);
      reject(signal?.reason || new DOMException('Aborted', 'AbortError'));
    };

    if (signal) {
      signal.addEventListener('abort', onAbort);
    }
  });
}

/**
 *
 * Wrapper fetch tự retry khi lỗi mạng, timeout,
 * hoặc mã HTTP tạm thời (429, 503, 500) từ Gemini API.
 *
 */
export async function fetchWithRetry(
  url: string | URL,
  options: RequestInit & { timeoutMs?: number },
  retryOptions: RetryOptions = {}
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
      throw callerSignal.reason || new DOMException('Aborted', 'AbortError');
    }

    const controller = new AbortController();
    let abortedByCaller = false;

    const onCallerAbort = () => {
      abortedByCaller = true;
      controller.abort(callerSignal?.reason);
    };

    if (callerSignal) {
      callerSignal.addEventListener('abort', onCallerAbort);
    }

    const timeoutId = setTimeout(() => {
      controller.abort('Timeout');
    }, timeoutMs);

    try {
      const fetchOptions = { ...options, signal: controller.signal };
      // Xóa timeoutMs tùy chỉnh nếu có để tránh truyền vào fetch
      delete fetchOptions.timeoutMs;

      const response = await fetch(url, fetchOptions);

      // Kiểm tra có nên retry dựa trên mã HTTP không
      // 429: quá nhiều request / giới hạn quota
      // 503: dịch vụ không khả dụng / tải cao / quá tải
      // 500: lỗi server nội bộ (thỉnh thoảng xảy ra ở Gemini)
      const shouldRetryStatus =
        response.status === 429 || response.status === 503 || response.status === 500;

      if (shouldRetryStatus && attempt <= maxRetries) {
        console.warn(
          `[Gemini Retry] Call returned status ${response.status}. Retrying (attempt ${attempt}/${maxRetries}) in ${Math.round(delay)}ms...`
        );
        await sleep(delay, callerSignal);
        delay *= backoffFactor;
        // Thêm jitter nhỏ (+/- 10%) để tránh dồn request cùng lúc
        delay += (Math.random() - 0.5) * 0.2 * delay;
        continue;
      }

      // Nếu tới đây thì request đã thành công, lỗi không retry được, hoặc đã hết lượt retry
      return response;
    } catch (error: unknown) {
      const isAbort = error instanceof Error && error.name === 'AbortError';
      const isAttemptTimeout = isAbort && controller.signal.aborted && !abortedByCaller;

      // Nếu parent/caller đã abort request, phải truyền abort đó ngay lập tức
      if (callerSignal?.aborted || abortedByCaller) {
        throw callerSignal?.reason || error;
      }

      // Nếu là timeout hoặc lỗi kết nối mạng thì có thể retry
      const isNetworkError = error instanceof TypeError; // fetch ném TypeError khi lỗi mạng
      const isRetryableError = isAttemptTimeout || isNetworkError;

      if (isRetryableError && attempt <= maxRetries) {
        console.warn(
          `[Gemini Retry] Call failed: ${error instanceof Error ? error.message : 'Timeout'}. Retrying (attempt ${attempt}/${maxRetries}) in ${Math.round(delay)}ms...`
        );
        await sleep(delay, callerSignal);
        delay *= backoffFactor;
        delay += (Math.random() - 0.5) * 0.2 * delay;
        continue;
      }

      // Ném lại lỗi nếu không thể retry hoặc đã hết lượt retry
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (callerSignal) {
        callerSignal.removeEventListener('abort', onCallerAbort);
      }
    }
  }
}
