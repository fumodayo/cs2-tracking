import {
  normalizeUserPreferences,
  type UserPreferences,
  type UserPricingPreferences,
  type UserExcelMappingTemplate,
} from '@/types/user-preferences';

export const USER_PREFERENCES_QUERY_KEY = ['user-preferences'];

type UserPreferencesPatch = {
  excelMappingTemplates?: UserExcelMappingTemplate[];
  pricing?: UserPricingPreferences;
};

type UserPreferencesResponse = {
  preferences?: UserPreferences;
  message?: string;
};

export async function fetchUserPreferences(): Promise<UserPreferences> {
  const response = await fetch('/api/user/preferences', { cache: 'no-store' });
  return parsePreferencesResponse(response);
}

export async function updateUserPreferences(patch: UserPreferencesPatch): Promise<UserPreferences> {
  const response = await fetch('/api/user/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return parsePreferencesResponse(response);
}

async function parsePreferencesResponse(response: Response): Promise<UserPreferences> {
  const data = (await response.json().catch(() => ({}))) as UserPreferencesResponse;
  if (!response.ok) {
    throw new Error(data.message ?? 'userPreferencesRequestFailed');
  }

  return normalizeUserPreferences(data.preferences);
}
