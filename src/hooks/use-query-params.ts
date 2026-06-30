import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

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
  [K in keyof T]: T[K]["defaultValue"];
};

export type QueryParamsSetters<T extends QueryParamsConfig> = {
  [K in keyof T]: (
    value:
      | T[K]["defaultValue"]
      | ((prev: T[K]["defaultValue"]) => T[K]["defaultValue"]),
  ) => void;
};

// Helper to check array equality (order-sensitive check for filters)
const isArrayEqual = (a: unknown[], b: unknown[]) => {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
};

// Helper to compare values deeply enough for our primitive/array settings
const isValueEqual = (a: unknown, b: unknown) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return isArrayEqual(a, b);
  }
  return a === b;
};

/**
 * A highly reusable React hook to synchronize multiple states with Next.js URL query parameters.
 * Complies with SOLID principles by remaining decoupled from specific business logic, open to configuration,
 * and single-focused on URL state synchronization.
 *
 * Includes support for:
 * - Parsing custom types (numbers, arrays, strings)
 * - Serializing states back to URL strings (cleaning up defaults)
 * - Debouncing high-frequency updates (e.g. search query typing) to keep browser history clean
 * - Correctly handling browser back/forward navigation.
 */
export function useQueryParamsState<T extends QueryParamsConfig>(
  config: T,
): [QueryParamsState<T>, QueryParamsSetters<T>, QueryParamsState<T>] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Reference to configuration to prevent dependency loop re-runs when config object is recreated inline
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Keys string dependency for tracking changes to the configuration structure
  const configKeysStr = useMemo(() => Object.keys(config).join(","), [config]);

  // Initialize local states from URL query parameters or default value
  const [states, setStates] = useState<QueryParamsState<T>>(() => {
    const initial = {} as QueryParamsState<T>;
    for (const key in config) {
      const urlValue = searchParams.get(key);
      (initial as Record<string, unknown>)[key] = config[key].parse(urlValue);
    }
    return initial;
  });

  // 2. Debounce states changes (for search inputs and fast typers)
  const [debouncedStates, setDebouncedStates] =
    useState<QueryParamsState<T>>(states);

  // Keep a ref to debouncedStates to check if URL updates are just catching up with our own debounces
  const debouncedStatesRef = useRef<QueryParamsState<T>>(debouncedStates);
  useEffect(() => {
    debouncedStatesRef.current = debouncedStates;
  }, [debouncedStates]);

  // 1. Sync URL searchParams updates (e.g. back/forward navigation) back to local state
  useEffect(() => {
    setStates((prev) => {
      let changed = false;
      const next = { ...prev };
      const currentConfig = configRef.current;
      const currentDebounced = debouncedStatesRef.current;

      for (const key in currentConfig) {
        const urlValue = searchParams.get(key);
        const parsed = currentConfig[key].parse(urlValue);
        // Only update local state if the URL value differs from both the current state AND the debounced state
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

  // 3. Sync debounced states back into Next.js router URL query params
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
      // Use replace and scroll: false to avoid jumping or pushing duplicate browser history entries
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [debouncedStates, pathname, router, searchParams, configKeysStr]);

  // 4. Generate stable memoized setters for callers to update individual states
  const setters = useMemo(() => {
    const s = {} as QueryParamsSetters<T>;
    const keys = configKeysStr.split(",");

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
