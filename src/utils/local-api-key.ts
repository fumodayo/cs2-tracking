const LOCAL_API_KEY_STORAGE_KEY = 'cs2cap_local_api_key';

export function getLocalApiKey(): string {
  if (typeof window === 'undefined') return '';

  const sessionValue = window.sessionStorage.getItem(LOCAL_API_KEY_STORAGE_KEY);
  if (sessionValue) return sessionValue;

  // Drop legacy persistent values. Browser-side obfuscation is not encryption.
  window.localStorage.removeItem(LOCAL_API_KEY_STORAGE_KEY);
  return '';
}

export function saveLocalApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LOCAL_API_KEY_STORAGE_KEY);
  window.sessionStorage.setItem(LOCAL_API_KEY_STORAGE_KEY, key);
}

export function removeLocalApiKey(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(LOCAL_API_KEY_STORAGE_KEY);
  window.localStorage.removeItem(LOCAL_API_KEY_STORAGE_KEY);
}
