import { normalizeRecentImports, type RecentImport } from '@/types/recent-import';

export const USER_RECENT_IMPORTS_QUERY_KEY = ['user-recent-imports'];

type UserRecentImportsResponse = {
  recentImports?: RecentImport[];
  message?: string;
};

export async function fetchUserRecentImports(): Promise<RecentImport[]> {
  const response = await fetch('/api/user/recent-imports', { cache: 'no-store' });
  return parseRecentImportsResponse(response);
}

export async function saveUserRecentImport(recentImport: RecentImport): Promise<RecentImport[]> {
  const response = await fetch('/api/user/recent-imports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ import: recentImport }),
  });
  return parseRecentImportsResponse(response);
}

export async function mergeUserRecentImports(imports: RecentImport[]): Promise<RecentImport[]> {
  const response = await fetch('/api/user/recent-imports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imports }),
  });
  return parseRecentImportsResponse(response);
}

export async function deleteUserRecentImport(id: string): Promise<RecentImport[]> {
  const response = await fetch(`/api/user/recent-imports?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return parseRecentImportsResponse(response);
}

export async function clearUserRecentImports(): Promise<RecentImport[]> {
  const response = await fetch('/api/user/recent-imports', { method: 'DELETE' });
  return parseRecentImportsResponse(response);
}

async function parseRecentImportsResponse(response: Response): Promise<RecentImport[]> {
  const data = (await response.json().catch(() => ({}))) as UserRecentImportsResponse;
  if (!response.ok) {
    throw new Error(data.message ?? 'recentImportsRequestFailed');
  }

  return normalizeRecentImports(data.recentImports);
}
