export const USER_AGENTS = {
  steamBrowser:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  steamApi: "Valve/Steam HTTP Client 1.0 (sevenup)",
  default:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export async function fetchCs2cApi(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const apiKey = process.env.CS2CAP_API_KEY?.trim();
  const headers = new Headers(options.headers);
  if (apiKey && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", USER_AGENTS.default);
  }
  const url = `https://api.cs2c.app${path}`;
  return fetch(url, { ...options, headers });
}

export async function fetchSteamApi(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", USER_AGENTS.steamBrowser);
  }
  return fetch(url, { ...options, headers });
}

export class HttpError extends Error {
  status: number;
  statusText: string;
  response: Response;
  data: any;

  constructor(response: Response, data: any) {
    super(
      data?.message ||
        data?.error ||
        response.statusText ||
        `HTTP Error ${response.status}`,
    );
    this.name = "HttpError";
    this.status = response.status;
    this.statusText = response.statusText;
    this.response = response;
    this.data = data;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

async function request<T>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const { params, headers, ...customOptions } = options;

  // 1. Build URL with query parameters if present
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
      finalUrl += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  // 2. Set default headers
  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
  };

  const mergedHeaders = {
    ...defaultHeaders,
    ...headers,
  } as Record<string, string>;

  // Remove Content-Type if body is FormData (e.g. file uploads) to let browser set boundary
  if (customOptions.body instanceof FormData) {
    delete mergedHeaders["Content-Type"];
  }

  // 3. Perform fetch
  const response = await fetch(finalUrl, {
    ...customOptions,
    headers: mergedHeaders,
  });

  // 4. Parse response body
  let data: any = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
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

  // 5. Handle HTTP errors (non-2xx status code)
  if (!response.ok) {
    throw new HttpError(response, data);
  }

  return data as T;
}

export const apiClient = {
  get<T>(url: string, options?: Omit<RequestOptions, "body">) {
    return request<T>(url, { ...options, method: "GET" });
  },

  post<T>(url: string, body?: any, options?: Omit<RequestOptions, "body">) {
    const requestBody = body instanceof FormData ? body : JSON.stringify(body);
    return request<T>(url, { ...options, method: "POST", body: requestBody });
  },

  put<T>(url: string, body?: any, options?: Omit<RequestOptions, "body">) {
    const requestBody = body instanceof FormData ? body : JSON.stringify(body);
    return request<T>(url, { ...options, method: "PUT", body: requestBody });
  },

  patch<T>(url: string, body?: any, options?: Omit<RequestOptions, "body">) {
    const requestBody = body instanceof FormData ? body : JSON.stringify(body);
    return request<T>(url, { ...options, method: "PATCH", body: requestBody });
  },

  delete<T>(url: string, options?: Omit<RequestOptions, "body">) {
    return request<T>(url, { ...options, method: "DELETE" });
  },
};
