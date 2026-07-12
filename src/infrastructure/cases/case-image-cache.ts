import type { CaseItem } from '@/domain/case-item';
import { getDatabase } from '@/infrastructure/db/mongo-client';
import { toObjectId } from '@/infrastructure/db/mappers';
import { lookupSteamCaseImage } from './steam-case-image-provider';

export const CASE_IMAGE_TRANSIENT_RETRY_MS = 2 * 60 * 1_000;
export const CASE_IMAGE_NOT_FOUND_RETRY_MS = 6 * 60 * 60 * 1_000;

const IMAGE_LOOKUP_CONCURRENCY = 4;

export async function enrichMissingCaseImages(cases: CaseItem[], now = new Date()): Promise<void> {
  const missingImageCases = cases.filter((caseItem) => !caseItem.imageUrl);
  if (missingImageCases.length === 0) {
    return;
  }

  const db = await getDatabase();
  const collection = db.collection('cases');
  const transientRetryAt = new Date(now.getTime() + CASE_IMAGE_TRANSIENT_RETRY_MS);

  for (let index = 0; index < missingImageCases.length; index += IMAGE_LOOKUP_CONCURRENCY) {
    const batch = missingImageCases.slice(index, index + IMAGE_LOOKUP_CONCURRENCY);

    await Promise.all(
      batch.map(async (caseItem) => {
        const objectId = toObjectId(caseItem.id);
        const claimedCase = await collection.findOneAndUpdate(
          {
            _id: objectId,
            isActive: true,
            $and: [
              {
                $or: [{ imageUrl: { $exists: false } }, { imageUrl: null }, { imageUrl: '' }],
              },
              {
                $or: [
                  { imageLookupRetryAt: { $exists: false } },
                  { imageLookupRetryAt: { $lte: now } },
                ],
              },
            ],
          },
          {
            $set: {
              imageLookupAttemptedAt: now,
              // Safety timeout: if the process stops mid-request, another worker can retry soon.
              imageLookupRetryAt: transientRetryAt,
            },
          }
        );

        // Another request/server has already fetched this image or owns the current lookup.
        if (!claimedCase) {
          return;
        }

        const result = await lookupSteamCaseImage(caseItem.marketHashName);
        if (result.status !== 'found') {
          const retryAt = new Date(
            now.getTime() +
              (result.status === 'not-found'
                ? CASE_IMAGE_NOT_FOUND_RETRY_MS
                : CASE_IMAGE_TRANSIENT_RETRY_MS)
          );

          await collection.updateOne(
            { _id: objectId },
            {
              $set: {
                imageLookupStatus: result.status,
                imageLookupRetryAt: retryAt,
              },
            }
          );
          return;
        }

        const { imageUrl } = result;
        caseItem.imageUrl = imageUrl;

        await collection.updateOne(
          { _id: objectId },
          {
            $set: {
              imageUrl,
              imageFetchedAt: now,
              updatedAt: now,
            },
            $unset: {
              imageLookupRetryAt: '',
              imageLookupStatus: '',
            },
          }
        );
      })
    );
  }
}
