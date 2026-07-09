import type { PostAnalysisDto, PostAnalysisHistoryItemDto } from '@/types/post-analysis';

export type UploadedPostImage = {
  fileName: string;
  mimeType: string;
  data: string;
  previewUrl: string;
};

export async function fetchPostAnalysisHistory(
  t?: (key: string) => string
): Promise<PostAnalysisHistoryItemDto[]> {
  const response = await fetch('/api/post/history', { cache: 'no-store' });
  const data = (await response.json()) as {
    items?: PostAnalysisHistoryItemDto[];
    message?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.message ??
        (t ? t('postAnalyzer.unableToLoadHistory') : 'Unable to load analysis history.')
    );
  }

  return Array.isArray(data.items) ? data.items : [];
}

export async function analyzePost({
  text,
  image,
  force,
  t,
}: {
  text: string;
  image: UploadedPostImage | null;
  force?: boolean;
  t?: (key: string) => string;
}): Promise<PostAnalysisDto> {
  const response = await fetch('/api/post/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      image: image
        ? {
            fileName: image.fileName,
            mimeType: image.mimeType,
            data: image.data,
          }
        : undefined,
      force,
    }),
  });
  const data = (await response.json()) as PostAnalysisDto | { message?: string };

  if (!response.ok) {
    throw new Error(
      'message' in data
        ? data.message
        : t
          ? t('postAnalyzer.unableToAnalyzePost')
          : 'Unable to analyze post.'
    );
  }

  return data as PostAnalysisDto;
}

export async function deletePostAnalysisHistoryItem(
  id: string,
  t?: (key: string) => string
): Promise<void> {
  const response = await fetch(`/api/post/history/${id}`, { method: 'DELETE' });
  const data = (await response.json()) as { message?: string };

  if (!response.ok) {
    throw new Error(
      data.message ??
        (t ? t('postAnalyzer.unableToDeleteHistory') : 'Unable to delete analysis history.')
    );
  }
}
