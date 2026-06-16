import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PriceService } from '../price-service';
import type { PriceSnapshotRepository } from '@/domain/repositories';
import type { PriceProvider } from '@/domain/price-provider';
import type { CaseItem } from '@/domain/case-item';
import type { PriceSnapshot } from '@/domain/price';

describe('price-service.ts tests', () => {
  const mockSnapshotRepo = {
    findLatest: vi.fn(),
    create: vi.fn(),
  } as unknown as PriceSnapshotRepository;

  const mockPriceProvider = {
    getCurrentPrice: vi.fn(),
  } as unknown as PriceProvider;

  const service = new PriceService(mockSnapshotRepo, mockPriceProvider);

  const mockCase: CaseItem = {
    id: 'case-1',
    name: 'Recoil Case',
    marketHashName: 'Recoil Case',
    imageUrl: '',
    isActive: true,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return cached price snapshot when it is fresh', async () => {
    const freshDate = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago (cache limit is 15 minutes)
    const mockSnapshot: PriceSnapshot = {
      id: 'snap-1',
      caseId: 'case-1',
      price: 15000,
      currency: 'VND',
      source: 'steam',
      capturedAt: freshDate,
    };

    vi.mocked(mockSnapshotRepo.findLatest).mockResolvedValue(mockSnapshot);

    const result = await service.getCurrentPrice(mockCase);
    expect(result).toEqual({ ...mockSnapshot, isCached: true });
    expect(mockSnapshotRepo.findLatest).toHaveBeenCalledWith('case-1');
    expect(mockPriceProvider.getCurrentPrice).not.toHaveBeenCalled();
  });

  it('should fetch live price and save to repo when cache is stale', async () => {
    const staleDate = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago (stale)
    const mockStaleSnapshot: PriceSnapshot = {
      id: 'snap-1',
      caseId: 'case-1',
      price: 15000,
      currency: 'VND',
      source: 'steam',
      capturedAt: staleDate,
    };
    const mockLivePrice = {
      caseId: 'case-1',
      price: 16000,
      currency: 'VND' as const,
      source: 'steam',
      capturedAt: new Date(),
    };
    const mockCreatedSnapshot: PriceSnapshot = {
      id: 'snap-2',
      ...mockLivePrice,
    };

    vi.mocked(mockSnapshotRepo.findLatest).mockResolvedValue(mockStaleSnapshot);
    vi.mocked(mockPriceProvider.getCurrentPrice).mockResolvedValue(mockLivePrice);
    vi.mocked(mockSnapshotRepo.create).mockResolvedValue(mockCreatedSnapshot);

    const result = await service.getCurrentPrice(mockCase);
    expect(result).toEqual({ ...mockCreatedSnapshot, isCached: false });
    expect(mockPriceProvider.getCurrentPrice).toHaveBeenCalledWith(mockCase, {
      preferFallback: undefined,
    });
    expect(mockSnapshotRepo.create).toHaveBeenCalledWith(mockLivePrice);
  });

  it('should fetch live price when forceRefresh is true even if cache is fresh', async () => {
    const freshDate = new Date(Date.now() - 5 * 60 * 1000);
    const mockSnapshot: PriceSnapshot = {
      id: 'snap-1',
      caseId: 'case-1',
      price: 15000,
      currency: 'VND',
      source: 'steam',
      capturedAt: freshDate,
    };
    const mockLivePrice = {
      caseId: 'case-1',
      price: 16000,
      currency: 'VND' as const,
      source: 'steam',
      capturedAt: new Date(),
    };
    const mockCreatedSnapshot: PriceSnapshot = {
      id: 'snap-2',
      ...mockLivePrice,
    };

    vi.mocked(mockSnapshotRepo.findLatest).mockResolvedValue(mockSnapshot);
    vi.mocked(mockPriceProvider.getCurrentPrice).mockResolvedValue(mockLivePrice);
    vi.mocked(mockSnapshotRepo.create).mockResolvedValue(mockCreatedSnapshot);

    const result = await service.getCurrentPrice(mockCase, { forceRefresh: true });
    expect(result).toEqual({ ...mockCreatedSnapshot, isCached: false });
    expect(mockPriceProvider.getCurrentPrice).toHaveBeenCalled();
  });

  it('should fallback to stale cache when live price fetch fails', async () => {
    const staleDate = new Date(Date.now() - 20 * 60 * 1000);
    const mockStaleSnapshot: PriceSnapshot = {
      id: 'snap-1',
      caseId: 'case-1',
      price: 15000,
      currency: 'VND',
      source: 'steam',
      capturedAt: staleDate,
    };

    vi.mocked(mockSnapshotRepo.findLatest).mockResolvedValue(mockStaleSnapshot);
    vi.mocked(mockPriceProvider.getCurrentPrice).mockResolvedValue(null);

    const result = await service.getCurrentPrice(mockCase);
    expect(result).toEqual({ ...mockStaleSnapshot, isCached: true });
    expect(mockSnapshotRepo.create).not.toHaveBeenCalled();
  });
});
