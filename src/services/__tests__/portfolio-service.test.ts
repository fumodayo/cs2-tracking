import { describe, it, expect, vi } from 'vitest';
import { PortfolioService } from '../portfolio-service';
import type { CaseRepository, PortfolioRepository } from '@/domain/repositories';
import type { CaseItem } from '@/domain/case-item';
import type { PortfolioItem } from '@/domain/portfolio-item';

describe('portfolio-service.ts tests', () => {
  const mockPortfolioRepo = {
    list: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  } as unknown as PortfolioRepository;

  const mockCaseRepo = {
    findById: vi.fn(),
    findByIds: vi.fn(),
  } as unknown as CaseRepository;

  const service = new PortfolioService(mockPortfolioRepo, mockCaseRepo);

  it('list should delegate to portfolioRepository.list', async () => {
    const mockItems: PortfolioItem[] = [];
    vi.mocked(mockPortfolioRepo.list).mockResolvedValue(mockItems);

    const result = await service.list();
    expect(result).toBe(mockItems);
    expect(mockPortfolioRepo.list).toHaveBeenCalled();
  });

  it('create should validate input and throw if validation fails', async () => {
    await expect(
      service.create({
        caseId: '',
        quantity: 10,
        buyPrice: 100,
        buyDate: new Date(),
      })
    ).rejects.toThrow('Vui lòng chọn case.');

    await expect(
      service.create({
        caseId: 'case-1',
        quantity: -10,
        buyPrice: 100,
        buyDate: new Date(),
      })
    ).rejects.toThrow('Số lượng phải lớn hơn 0.');

    await expect(
      service.create({
        caseId: 'case-1',
        quantity: 10,
        buyPrice: -50,
        buyDate: new Date(),
      })
    ).rejects.toThrow('Giá mua phải lớn hơn 0.');

    await expect(
      service.create({
        caseId: 'case-1',
        quantity: 10,
        buyPrice: 100,
        buyDate: new Date('invalid'),
      })
    ).rejects.toThrow('Ngày mua không hợp lệ.');
  });

  it("create should throw if case doesn't exist", async () => {
    vi.mocked(mockCaseRepo.findById).mockResolvedValue(null);

    await expect(
      service.create({
        caseId: 'non-existent-case',
        quantity: 10,
        buyPrice: 100,
        buyDate: new Date(),
      })
    ).rejects.toThrow('Case không tồn tại.');
  });

  it('create should save item if validation succeeds and case exists', async () => {
    const mockCase: CaseItem = {
      id: 'case-1',
      name: 'Recoil Case',
      marketHashName: 'Recoil Case',
      imageUrl: '',
      isActive: true,
    };
    const mockItem: PortfolioItem = {
      id: 'item-1',
      caseId: 'case-1',
      quantity: 10,
      buyPrice: 100,
      buyCurrency: 'VND',
      buyDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockCaseRepo.findById).mockResolvedValue(mockCase);
    vi.mocked(mockPortfolioRepo.create).mockResolvedValue(mockItem);

    const result = await service.create({
      caseId: 'case-1',
      quantity: 10,
      buyPrice: 100,
      buyDate: new Date(),
    });

    expect(result).toBe(mockItem);
    expect(mockPortfolioRepo.create).toHaveBeenCalled();
  });
});
