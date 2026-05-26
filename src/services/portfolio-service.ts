import type {
  CreatePortfolioItemInput,
  PortfolioItem,
  UpdatePortfolioItemInput,
} from "@/domain/portfolio-item";
import type { CaseRepository, PortfolioRepository } from "@/domain/repositories";

export class PortfolioService {
  constructor(
    private readonly portfolioRepository: PortfolioRepository,
    private readonly caseRepository: CaseRepository,
  ) {}

  async list(): Promise<PortfolioItem[]> {
    return this.portfolioRepository.list();
  }

  async create(input: CreatePortfolioItemInput): Promise<PortfolioItem> {
    validatePortfolioInput(input);

    const caseItem = await this.caseRepository.findById(input.caseId);
    if (!caseItem) {
      throw new Error("Case không tồn tại.");
    }

    return this.portfolioRepository.create(input);
  }

  async createMany(inputs: CreatePortfolioItemInput[]): Promise<PortfolioItem[]> {
    const createdItems: PortfolioItem[] = [];

    for (const input of inputs) {
      createdItems.push(await this.create(input));
    }

    return createdItems;
  }

  async update(id: string, input: UpdatePortfolioItemInput): Promise<PortfolioItem | null> {
    validatePortfolioInput(input, true);
    return this.portfolioRepository.update(id, input);
  }

  async delete(id: string): Promise<boolean> {
    return this.portfolioRepository.delete(id);
  }
}

function validatePortfolioInput(input: Partial<CreatePortfolioItemInput>, partial = false) {
  if (!partial && !input.caseId) {
    throw new Error("Vui lòng chọn case.");
  }

  if (input.quantity !== undefined && (!Number.isFinite(input.quantity) || input.quantity <= 0)) {
    throw new Error("Số lượng phải lớn hơn 0.");
  }

  if (input.buyPrice !== undefined && (!Number.isFinite(input.buyPrice) || input.buyPrice <= 0)) {
    throw new Error("Giá mua phải lớn hơn 0.");
  }

  if (input.buyDate !== undefined && Number.isNaN(input.buyDate.getTime())) {
    throw new Error("Ngày mua không hợp lệ.");
  }
}
