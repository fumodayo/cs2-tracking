import { createHash } from 'node:crypto';
import { isRecord } from '@/utils/type-guards';

/**
 * Creates a stable SHA256 fingerprint for a post analysis based on text and image data.
 */
export function createPostAnalysisFingerprint(
  text: string,
  imageOrImages:
    | { data: string; mimeType: string }
    | Array<{ data: string; mimeType: string }>
    | undefined
): string {
  const normalizedText = text.replace(/\s+/g, ' ').trim().toLowerCase();
  let imageHash = 'no-image';

  if (imageOrImages) {
    const images = Array.isArray(imageOrImages) ? imageOrImages : [imageOrImages];
    if (images.length > 0) {
      const hash = createHash('sha256');
      const sorted = [...images].sort((a, b) => a.data.localeCompare(b.data));
      sorted.forEach((img) => {
        hash.update(img.mimeType).update(':').update(img.data).update('|');
      });
      imageHash = hash.digest('hex');
    }
  }

  return createHash('sha256').update(normalizedText).update('|').update(imageHash).digest('hex');
}

/**
 * Creates a stable SHA256 fingerprint for a ChatGPT analyzed post based on text and JSON data.
 */
export function createChatGptPostAnalysisFingerprint(text: string, json: unknown): string {
  const normalizedText = text.replace(/\s+/g, ' ').trim().toLowerCase();
  const jsonStr = JSON.stringify(json);
  return createHash('sha256')
    .update(normalizedText)
    .update('|chatgpt|')
    .update(jsonStr)
    .digest('hex');
}

/**
 * Validates and normalizes base64 image data inputs.
 */
export function normalizeImageInput(
  value: unknown
): { data: string; mimeType: string; fileName?: string } | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const rawData = typeof value.data === 'string' ? value.data.trim() : '';
  const mimeType = typeof value.mimeType === 'string' ? value.mimeType.trim().toLowerCase() : '';
  if (!rawData && !mimeType) {
    return undefined;
  }

  if (!/^image\/(?:png|jpe?g|webp)$/.test(mimeType)) {
    throw new Error('invalidImageFormat');
  }

  const data = rawData.includes(',') ? (rawData.split(',').pop() ?? '') : rawData;
  if (!/^[a-z0-9+/=\r\n]+$/i.test(data) || data.length === 0) {
    throw new Error('invalidImageData');
  }

  if (data.length > 8_000_000) {
    throw new Error('imageTooLarge');
  }

  return {
    data,
    mimeType,
    fileName:
      typeof value.fileName === 'string' && value.fileName.trim()
        ? value.fileName.trim().slice(0, 180)
        : undefined,
  };
}
