import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export interface ParamConfig<T> {
  defaultValue: T;
  parse: (value: string | null) => T;
  serialize: (value: T) => string | null;
  debounceMs?: number;
}

export type QueryParamsConfig = Record<
  string,
  {
    defaultValue: unknown;
    parse: (value: string | null) => unknown;
    serialize: (value: never) => string | null;
    debounceMs?: number;
  }
>;

export type QueryParamsState<T extends QueryParamsConfig> = {
  [K in keyof T]: T[K]['defaultValue'];
};

export type QueryParamsSetters<T extends QueryParamsConfig> = {
  [K in keyof T]: (
    value: T[K]['defaultValue'] | ((prev: T[K]['defaultValue']) => T[K]['defaultValue'])
  ) => void;
};

// Helper kiểm tra array bằng nhau, có xét thứ tự cho filter
const isArrayEqual = (a: unknown[], b: unknown[]) => {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
};

// Helper so sánh đủ sâu cho cấu hình primitive/array
const isValueEqual = (a: unknown, b: unknown) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return isArrayEqual(a, b);
  }
  return a === b;
};

/**
 *
 * React hook tái sử dụng cao để đồng bộ nhiều state với query parameter URL của Next.js.
 * Tuân thủ SOLID bằng cách tách khỏi logic nghiệp vụ cụ thể, mở cho cấu hình,
 * và chỉ tập trung vào đồng bộ state với URL.
 *
 * Hỗ trợ:
 * - Parse kiểu tùy chỉnh (number, array, string)
 * - Serialize state ngược về chuỗi URL và dọn giá trị mặc định
 * - Debounce cập nhật tần suất cao (ví dụ gõ query tìm kiếm) để lịch sử trình duyệt gọn
 * - Xử lý đúng điều hướng back/forward của trình duyệt.
 *
 */
export function useQueryParamsState<T extends QueryParamsConfig>(
  config: T
): [QueryParamsState<T>, QueryParamsSetters<T>, QueryParamsState<T>] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Tham chiếu tới cấu hình để tránh vòng dependency chạy lại khi object config được tạo inline
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Chuỗi key dependency để theo dõi thay đổi cấu trúc cấu hình
  const configKeysStr = useMemo(() => Object.keys(config).join(','), [config]);

  // Khởi tạo state local từ query parameter URL hoặc giá trị mặc định
  const [states, setStates] = useState<QueryParamsState<T>>(() => {
    const initial = {} as QueryParamsState<T>;
    for (const key in config) {
      const urlValue = searchParams.get(key);
      (initial as Record<string, unknown>)[key] = config[key].parse(urlValue);
    }
    return initial;
  });

  // 2. Debounce thay đổi state cho ô tìm kiếm và người gõ nhanh
  const [debouncedStates, setDebouncedStates] = useState<QueryParamsState<T>>(states);

  // Giữ ref tới debouncedStates để kiểm tra update URL có chỉ đang bắt kịp debounce của chính ta không
  const debouncedStatesRef = useRef<QueryParamsState<T>>(debouncedStates);
  useEffect(() => {
    debouncedStatesRef.current = debouncedStates;
  }, [debouncedStates]);

  // 1. Đồng bộ update searchParams URL (ví dụ back/forward) về state local
  useEffect(() => {
    setStates((prev) => {
      let changed = false;
      const next = { ...prev };
      const currentConfig = configRef.current;
      const currentDebounced = debouncedStatesRef.current;

      for (const key in currentConfig) {
        const urlValue = searchParams.get(key);
        const parsed = currentConfig[key].parse(urlValue);
        // Chỉ cập nhật state local nếu giá trị URL khác cả state hiện tại và state đã debounce
        if (!isValueEqual(next[key], parsed) && !isValueEqual(currentDebounced[key], parsed)) {
          (next as Record<string, unknown>)[key] = parsed;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [searchParams, configKeysStr]);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    const currentConfig = configRef.current;
    const updatedImmediate = { ...debouncedStates } as QueryParamsState<T>;
    let hasImmediateChange = false;

    for (const key in currentConfig) {
      const value = states[key];
      const debounceMs = currentConfig[key].debounceMs;

      if (debounceMs && debounceMs > 0) {
        const timer = setTimeout(() => {
          setDebouncedStates((prev) => {
            if (!isValueEqual(prev[key], value)) {
              return { ...prev, [key]: value };
            }
            return prev;
          });
        }, debounceMs);
        timers.push(timer);
      } else {
        if (!isValueEqual(updatedImmediate[key], value)) {
          (updatedImmediate as Record<string, unknown>)[key] = value;
          hasImmediateChange = true;
        }
      }
    }

    if (hasImmediateChange) {
      setDebouncedStates(updatedImmediate);
    }

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [states, configKeysStr, debouncedStates]);

  // 3. Đồng bộ state đã debounce ngược vào query parameter URL của router Next.js
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let urlChanged = false;
    const currentConfig = configRef.current;

    for (const key in currentConfig) {
      const value = debouncedStates[key];
      const serializeFn = currentConfig[key].serialize as (val: unknown) => string | null;
      const serialized = serializeFn(value);
      const current = params.get(key);

      if (serialized === null) {
        if (current !== null) {
          params.delete(key);
          urlChanged = true;
        }
      } else {
        if (current !== serialized) {
          params.set(key, serialized);
          urlChanged = true;
        }
      }
    }

    if (urlChanged) {
      // Dùng replace và scroll: false để tránh nhảy trang hoặc thêm bản ghi lịch sử trùng
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [debouncedStates, pathname, router, searchParams, configKeysStr]);

  // 4. Tạo setter memo ổn định để caller cập nhật từng state riêng
  const setters = useMemo(() => {
    const s = {} as QueryParamsSetters<T>;
    const keys = configKeysStr.split(',');

    for (const key of keys) {
      (s as Record<string, (value: unknown) => void>)[key] = (value: unknown) => {
        setStates((prev) => {
          const prevVal = (prev as Record<string, unknown>)[key];
          const nextVal = value instanceof Function ? value(prevVal) : value;
          if (isValueEqual(prevVal, nextVal)) return prev;
          return { ...prev, [key]: nextVal };
        });
      };
    }
    return s;
  }, [configKeysStr]);

  return [states, setters, debouncedStates];
}
