import { ObjectId } from 'mongodb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CaseItem } from '@/domain/case-item';

const mocks = vi.hoisted(() => ({
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
  getDatabase: vi.fn(),
  getSteamCaseImageUrl: vi.fn(),
}));

vi.mock('@/infrastructure/db/mongo-client', () => ({
  getDatabase: mocks.getDatabase,
}));

vi.mock('./steam-case-image-provider', () => ({
  getSteamCaseImageUrl: mocks.getSteamCaseImageUrl,
}));

import { CASE_IMAGE_LOOKUP_RETRY_MS, enrichMissingCaseImages } from './case-image-cache';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDatabase.mockResolvedValue({
    collection: () => ({
      findOneAndUpdate: mocks.findOneAndUpdate,
      updateOne: mocks.updateOne,
    }),
  });
});

describe('enrichMissingCaseImages', () => {
  it('stores a newly discovered image URL in the case document', async () => {
    const item = createCaseItem('New CS2 Case');
    const now = new Date('2026-07-12T00:00:00.000Z');
    const imageUrl = 'https://community.cloudflare.steamstatic.com/economy/image/new-case';
    mocks.findOneAndUpdate.mockResolvedValue({ _id: new ObjectId(item.id) });
    mocks.getSteamCaseImageUrl.mockResolvedValue(imageUrl);
    mocks.updateOne.mockResolvedValue({ acknowledged: true });

    await enrichMissingCaseImages([item], now);

    expect(item.imageUrl).toBe(imageUrl);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { _id: new ObjectId(item.id) },
      {
        $set: {
          imageUrl,
          imageFetchedAt: now,
          updatedAt: now,
        },
      }
    );
  });

  it('claims a missing image lookup only after the retry cooldown', async () => {
    const item = createCaseItem('Not Indexed Yet Case');
    const now = new Date('2026-07-12T12:00:00.000Z');
    mocks.findOneAndUpdate.mockResolvedValue(null);

    await enrichMissingCaseImages([item], now);

    const retryBefore = new Date(now.getTime() - CASE_IMAGE_LOOKUP_RETRY_MS);
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: new ObjectId(item.id),
        $and: expect.arrayContaining([
          {
            $or: [
              { imageLookupAttemptedAt: { $exists: false } },
              { imageLookupAttemptedAt: { $lte: retryBefore } },
            ],
          },
        ]),
      }),
      { $set: { imageLookupAttemptedAt: now } }
    );
    expect(mocks.getSteamCaseImageUrl).not.toHaveBeenCalled();
  });

  it('keeps the retry timestamp without storing an empty image result', async () => {
    const item = createCaseItem('Temporarily Missing Case');
    mocks.findOneAndUpdate.mockResolvedValue({ _id: new ObjectId(item.id) });
    mocks.getSteamCaseImageUrl.mockResolvedValue(null);

    await enrichMissingCaseImages([item]);

    expect(item.imageUrl).toBeUndefined();
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('does not look up images that are already stored', async () => {
    const item = {
      ...createCaseItem('Stored Image Case'),
      imageUrl: 'https://community.cloudflare.steamstatic.com/economy/image/stored',
    };

    await enrichMissingCaseImages([item]);

    expect(mocks.getDatabase).not.toHaveBeenCalled();
    expect(mocks.getSteamCaseImageUrl).not.toHaveBeenCalled();
  });
});

function createCaseItem(marketHashName: string): CaseItem {
  return {
    id: new ObjectId().toHexString(),
    name: marketHashName,
    marketHashName,
    isActive: true,
  };
}
