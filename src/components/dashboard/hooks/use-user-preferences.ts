'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClientSessionUser } from '@/components/auth/use-session';
import type { MappingTemplate } from '@/components/portfolio';
import {
  fetchUserPreferences,
  updateUserPreferences,
  USER_PREFERENCES_QUERY_KEY,
} from '@/lib/api-client/user-preferences-api';
import { subscribeUserPreferencesChanges } from '@/lib/api-client/user-preferences-realtime';
import {
  normalizeExcelMappingTemplates,
  normalizePricingValue,
  type UserPreferences,
  type UserPricingPreferenceKey,
} from '@/types/user-preferences';

type SyncedPreferenceOptions = {
  user: ClientSessionUser | null;
  sessionLoading: boolean;
};

type SetStateAction<T> = T | ((prev: T) => T);

const LOCAL_EXCEL_MAPPING_TEMPLATES_KEY = 'cs2t_excelMappingTemplates';
const USER_PREFERENCES_STALE_TIME_MS = 5 * 60 * 1000;

export function useUserPreferencesRealtime({
  user,
  sessionLoading,
}: SyncedPreferenceOptions): void {
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId || sessionLoading) return;

    return subscribeUserPreferencesChanges(() => {
      void fetchUserPreferences()
        .then((preferences) => {
          queryClient.setQueryData(USER_PREFERENCES_QUERY_KEY, preferences);
        })
        .catch((error) => {
          console.error('Failed to refresh realtime user preferences:', error);
          void queryClient.invalidateQueries({ queryKey: USER_PREFERENCES_QUERY_KEY });
        });
    });
  }, [queryClient, sessionLoading, userId]);
}

export function useSyncedExcelMappingTemplates({
  user,
  sessionLoading,
}: SyncedPreferenceOptions): [
  MappingTemplate[],
  (value: SetStateAction<MappingTemplate[]>) => void,
] {
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const [localTemplates, setLocalTemplates] = useState<MappingTemplate[]>(() =>
    readLocalMappingTemplates()
  );
  const migratedForUserRef = useRef<string | null>(null);

  const preferencesQuery = useUserPreferencesQuery(userId, sessionLoading);
  const serverTemplates = useMemo(
    () => (preferencesQuery.data?.excelMappingTemplates ?? []) as MappingTemplate[],
    [preferencesQuery.data?.excelMappingTemplates]
  );
  const templates = userId ? serverTemplates : localTemplates;

  useEffect(() => {
    if (!userId || sessionLoading || !preferencesQuery.data) return;
    if (migratedForUserRef.current === userId) return;
    migratedForUserRef.current = userId;

    const local = readLocalMappingTemplates();
    if (local.length === 0) return;

    const merged = mergeMappingTemplates(serverTemplates, local);
    window.localStorage.removeItem(LOCAL_EXCEL_MAPPING_TEMPLATES_KEY);
    setLocalTemplates([]);

    if (areMappingTemplatesEqual(merged, serverTemplates)) return;

    queryClient.setQueryData<UserPreferences>(USER_PREFERENCES_QUERY_KEY, (previous) => ({
      excelMappingTemplates: merged,
      pricing: previous?.pricing ?? preferencesQuery.data?.pricing ?? {},
    }));

    void updateUserPreferences({ excelMappingTemplates: merged })
      .then((preferences) => {
        queryClient.setQueryData(USER_PREFERENCES_QUERY_KEY, preferences);
      })
      .catch((error) => {
        console.error('Failed to migrate Excel mapping templates:', error);
      });
  }, [preferencesQuery.data, queryClient, serverTemplates, sessionLoading, userId]);

  const setTemplates = useCallback(
    (value: SetStateAction<MappingTemplate[]>) => {
      const current = userId ? serverTemplates : localTemplates;
      const next = normalizeExcelMappingTemplates(
        resolveStateAction(value, current)
      ) as MappingTemplate[];

      if (!userId) {
        setLocalTemplates(next);
        writeLocalJson(LOCAL_EXCEL_MAPPING_TEMPLATES_KEY, next);
        return;
      }

      queryClient.setQueryData<UserPreferences>(USER_PREFERENCES_QUERY_KEY, (previous) => ({
        excelMappingTemplates: next,
        pricing: previous?.pricing ?? preferencesQuery.data?.pricing ?? {},
      }));

      void updateUserPreferences({ excelMappingTemplates: next })
        .then((preferences) => {
          queryClient.setQueryData(USER_PREFERENCES_QUERY_KEY, preferences);
        })
        .catch((error) => {
          console.error('Failed to persist Excel mapping templates:', error);
        });
    },
    [localTemplates, preferencesQuery.data?.pricing, queryClient, serverTemplates, userId]
  );

  return [templates, setTemplates];
}

export function useSyncedPricingPreference({
  user,
  sessionLoading,
  preferenceKey,
  localStorageKey,
  fallback,
}: SyncedPreferenceOptions & {
  preferenceKey: UserPricingPreferenceKey;
  localStorageKey: string;
  fallback: number;
}): [number, (value: SetStateAction<number>) => void] {
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const [localValue, setLocalValue] = useState(() => readLocalNumber(localStorageKey, fallback));
  const migratedForUserRef = useRef<string | null>(null);

  const preferencesQuery = useUserPreferencesQuery(userId, sessionLoading);
  const serverValue = preferencesQuery.data?.pricing?.[preferenceKey];
  const value = userId && serverValue !== undefined ? serverValue : localValue;

  useEffect(() => {
    if (!userId || sessionLoading || !preferencesQuery.data) return;

    const migrationKey = `${userId}:${preferenceKey}`;
    if (migratedForUserRef.current === migrationKey) return;
    migratedForUserRef.current = migrationKey;

    const local = readLocalNumberOrNull(localStorageKey, preferenceKey);
    if (local === null) return;

    window.localStorage.removeItem(localStorageKey);
    if (preferencesQuery.data.pricing[preferenceKey] !== undefined) return;

    const nextPreferences = setPricingInCache(
      queryClient,
      preferencesQuery.data,
      preferenceKey,
      local
    );

    void updateUserPreferences({ pricing: { [preferenceKey]: local } })
      .then((preferences) => {
        queryClient.setQueryData(USER_PREFERENCES_QUERY_KEY, preferences);
      })
      .catch((error) => {
        queryClient.setQueryData(USER_PREFERENCES_QUERY_KEY, nextPreferences);
        console.error(`Failed to migrate pricing preference ${preferenceKey}:`, error);
      });
  }, [localStorageKey, preferenceKey, preferencesQuery.data, queryClient, sessionLoading, userId]);

  const setValue = useCallback(
    (nextValue: SetStateAction<number>) => {
      const resolvedValue = resolveStateAction(nextValue, value);
      const normalized = normalizePricingValue(preferenceKey, resolvedValue) ?? fallback;

      if (!userId) {
        setLocalValue(normalized);
        window.localStorage.setItem(localStorageKey, String(normalized));
        return;
      }

      setPricingInCache(queryClient, preferencesQuery.data, preferenceKey, normalized);

      void updateUserPreferences({ pricing: { [preferenceKey]: normalized } })
        .then((preferences) => {
          queryClient.setQueryData(USER_PREFERENCES_QUERY_KEY, preferences);
        })
        .catch((error) => {
          console.error(`Failed to persist pricing preference ${preferenceKey}:`, error);
        });
    },
    [fallback, localStorageKey, preferenceKey, preferencesQuery.data, queryClient, userId, value]
  );

  return [value, setValue];
}

function useUserPreferencesQuery(userId: string | null, sessionLoading: boolean) {
  return useQuery({
    queryKey: USER_PREFERENCES_QUERY_KEY,
    queryFn: fetchUserPreferences,
    enabled: Boolean(userId) && !sessionLoading,
    staleTime: USER_PREFERENCES_STALE_TIME_MS,
    retry: false,
  });
}

function setPricingInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  currentPreferences: UserPreferences | undefined,
  preferenceKey: UserPricingPreferenceKey,
  value: number
): UserPreferences {
  const nextPreferences: UserPreferences = {
    excelMappingTemplates: currentPreferences?.excelMappingTemplates ?? [],
    pricing: {
      ...(currentPreferences?.pricing ?? {}),
      [preferenceKey]: value,
    },
  };

  queryClient.setQueryData<UserPreferences>(USER_PREFERENCES_QUERY_KEY, nextPreferences);
  return nextPreferences;
}

function resolveStateAction<T>(value: SetStateAction<T>, previous: T): T {
  return typeof value === 'function' ? (value as (prev: T) => T)(previous) : value;
}

function readLocalMappingTemplates(): MappingTemplate[] {
  return normalizeExcelMappingTemplates(
    readLocalJson(LOCAL_EXCEL_MAPPING_TEMPLATES_KEY, [])
  ) as MappingTemplate[];
}

function readLocalNumber(key: string, fallback: number): number {
  const value = readLocalNumberOrNull(key);
  return value ?? fallback;
}

function readLocalNumberOrNull(
  key: string,
  preferenceKey?: UserPricingPreferenceKey
): number | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(key);
  if (raw === null) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    const normalized =
      preferenceKey === undefined ? Number(parsed) : normalizePricingValue(preferenceKey, parsed);
    return Number.isFinite(normalized) ? normalized : null;
  } catch {
    const normalized =
      preferenceKey === undefined ? Number(raw) : normalizePricingValue(preferenceKey, raw);
    return Number.isFinite(normalized) ? normalized : null;
  }
}

function readLocalJson(key: string, fallback: unknown): unknown {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function mergeMappingTemplates(
  serverTemplates: MappingTemplate[],
  localTemplates: MappingTemplate[]
): MappingTemplate[] {
  const byId = new Map<string, MappingTemplate>();

  for (const template of [...serverTemplates, ...localTemplates]) {
    byId.set(template.id, template);
  }

  return Array.from(byId.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);
}

function areMappingTemplatesEqual(a: MappingTemplate[], b: MappingTemplate[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
