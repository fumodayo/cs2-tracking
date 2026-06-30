const LOCAL_API_KEY_STORAGE_KEY = 'cs2cap_local_api_key';

function encryptKey(key: string): string {
  if (typeof window === 'undefined') return '';
  const reversed = key.split('').reverse().join('');
  return window.btoa(unescape(encodeURIComponent(reversed)));
}

function decryptKey(hash: string): string {
  if (typeof window === 'undefined') return '';
  try {
    const decoded = decodeURIComponent(escape(window.atob(hash)));
    return decoded.split('').reverse().join('');
  } catch {
    return '';
  }
}

export function getLocalApiKey(): string {
  if (typeof window === 'undefined') return '';
  const encrypted = localStorage.getItem(LOCAL_API_KEY_STORAGE_KEY);
  return encrypted ? decryptKey(encrypted) : '';
}

export function saveLocalApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_API_KEY_STORAGE_KEY, encryptKey(key));
}

export function removeLocalApiKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LOCAL_API_KEY_STORAGE_KEY);
}
