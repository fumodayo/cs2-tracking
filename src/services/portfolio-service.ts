import type {
  CreatePortfolioItemInput,
  PortfolioItem,
  UpdatePortfolioItemInput,
} from "@/domain/portfolio-item";
import type {
  CaseRepository,
  PortfolioRepository,
} from "@/domain/repositories";

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
      throw new Error("caseNotFound");
    }

    return this.portfolioRepository.create(input);
  }

  async createMany(
    inputs: CreatePortfolioItemInput[],
  ): Promise<PortfolioItem[]> {
    if (inputs.length === 0) return [];

    for (const input of inputs) {
      validatePortfolioInput(input);
    }

    const uniqueCaseIds = Array.from(
      new Set(inputs.map((input) => input.caseId)),
    );
    const existingCases = await this.caseRepository.findByIds(uniqueCaseIds);
    const existingCaseIds = new Set(existingCases.map((c) => String(c.id)));

    for (const input of inputs) {
      if (!existingCaseIds.has(input.caseId)) {
        throw new Error(`caseNotFoundWithId:id=${input.caseId}`);
      }
    }

    return this.portfolioRepository.createMany(inputs);
  }

  async update(
    id: string,
    input: UpdatePortfolioItemInput,
  ): Promise<PortfolioItem | null> {
    validatePortfolioInput(input, true);
    return this.portfolioRepository.update(id, input);
  }

  async delete(id: string): Promise<boolean> {
    return this.portfolioRepository.delete(id);
  }

  async deleteMany(ids: string[]): Promise<boolean> {
    return this.portfolioRepository.deleteMany(ids);
  }
}

function validatePortfolioInput(
  input: Partial<CreatePortfolioItemInput>,
  partial = false,
) {
  if (!partial && !input.caseId) {
    throw new Error("caseIdRequired");
  }

  if (
    input.quantity !== undefined &&
    (!Number.isFinite(input.quantity) || input.quantity <= 0)
  ) {
    throw new Error("quantityMustBePositive");
  }

  if (
    input.buyPrice !== undefined &&
    (!Number.isFinite(input.buyPrice) || input.buyPrice <= 0)
  ) {
    throw new Error("buyPriceMustBePositive");
  }

  if (input.buyDate !== undefined && Number.isNaN(input.buyDate.getTime())) {
    throw new Error("buyDateInvalid");
  }
}
