export const USER_AGENTS = {
  steamBrowser:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  steamApi: 'Valve/Steam HTTP Client 1.0 (sevenup)',
  default:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

export async function fetchCs2cApi(path: string, options: RequestInit = {}): Promise<Response> {
  let apiKey = process.env.CS2CAP_API_KEY?.trim();

  // Thử dùng API key tùy chỉnh của user đã đăng nhập
  try {
    const { getCurrentUser, getUserCs2capApiKey } = await import('@/services/auth-service');
    const user = await getCurrentUser();
    if (user?.id) {
      const userKey = await getUserCs2capApiKey(user.id);
      if (userKey) {
        apiKey = userKey;
      }
    }
  } catch (err) {
    // Bỏ qua lỗi nhẹ nhàng nếu gọi ngoài request context hoặc DB chưa kết nối
    console.warn(
      'Could not retrieve custom user CS2Cap API key, falling back to environment key:',
      err
    );
  }

  const headers = new Headers(options.headers);
  if (apiKey && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${apiKey}`);
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', USER_AGENTS.default);
  }
  const url = `https://api.cs2c.app${path}`;
  return fetch(url, { ...options, headers });
}

export async function fetchSteamApi(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', USER_AGENTS.steamBrowser);
  }
  return fetch(url, { ...options, headers });
}

export class HttpError extends Error {
  status: number;
  statusText: string;
  response: Response;
  data: unknown;

  constructor(response: Response, data: unknown) {
    const dataObj = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
    const msg =
      typeof dataObj?.message === 'string'
        ? dataObj.message
        : typeof dataObj?.error === 'string'
          ? dataObj.error
          : typeof data === 'string'
            ? data
            : '';
    super(msg || response.statusText || `HTTP Error ${response.status}`);
    this.name = 'HttpError';
    this.status = response.status;
    this.statusText = response.statusText;
    this.response = response;
    this.data = data;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...customOptions } = options;

  // 1. Tạo URL kèm query parameter nếu có
  let finalUrl = url;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      finalUrl += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  // 2. Đặt header mặc định
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const mergedHeaders = {
    ...defaultHeaders,
    ...headers,
  } as Record<string, string>;

  // Xóa Content-Type nếu body là FormData để trình duyệt tự đặt boundary
  if (customOptions.body instanceof FormData) {
    delete mergedHeaders['Content-Type'];
  }

  // 3. Thực hiện fetch
  const response = await fetch(finalUrl, {
    ...customOptions,
    headers: mergedHeaders,
  });

  // 4. Parse body response
  let data: unknown = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await response.text();
    } catch {
      data = null;
    }
  }

  // 5. Xử lý lỗi HTTP (status code không phải 2xx)
  if (!response.ok) {
    throw new HttpError(response, data);
  }

  return data as T;
}

export const apiClient = {
  get<T>(url: string, options?: Omit<RequestOptions, 'body'>) {
    return request<T>(url, { ...options, method: 'GET' });
  },

  post<T>(url: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) {
    const requestBody = body instanceof FormData ? body : JSON.stringify(body);
    return request<T>(url, { ...options, method: 'POST', body: requestBody });
  },

  put<T>(url: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) {
    const requestBody = body instanceof FormData ? body : JSON.stringify(body);
    return request<T>(url, { ...options, method: 'PUT', body: requestBody });
  },

  patch<T>(url: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) {
    const requestBody = body instanceof FormData ? body : JSON.stringify(body);
    return request<T>(url, { ...options, method: 'PATCH', body: requestBody });
  },

  delete<T>(url: string, options?: Omit<RequestOptions, 'body'>) {
    return request<T>(url, { ...options, method: 'DELETE' });
  },
};
