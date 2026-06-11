import type { CaseRepository } from "@/domain/repositories";
import type { PortfolioService } from "./portfolio-service";

export type PortfolioImportRowInput = {
  caseId?: string;
  marketHashName?: string;
  quantity: number;
  buyPrice: number;
  buyDate: Date;
  note?: string;
};

export type PortfolioImportResult = {
  importedCount: number;
  importedIds: string[];
};

export class PortfolioImportService {
  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly caseRepository: CaseRepository,
  ) {}

  async importRows(
    rows: PortfolioImportRowInput[],
  ): Promise<PortfolioImportResult> {
    if (rows.length === 0) {
      throw new Error("File không có dòng portfolio hợp lệ.");
    }

    const inputs = [];

    for (const [index, row] of rows.entries()) {
      const caseId = await this.resolveCaseId(row, index);
      inputs.push({
        caseId,
        quantity: row.quantity,
        buyPrice: row.buyPrice,
        buyDate: row.buyDate,
        note: row.note,
      });
    }

    const createdItems = await this.portfolioService.createMany(inputs);

    return {
      importedCount: createdItems.length,
      importedIds: createdItems.map((item) => item.id),
    };
  }

  private async resolveCaseId(
    row: PortfolioImportRowInput,
    index: number,
  ): Promise<string> {
    if (row.caseId) {
      const caseItem = await this.caseRepository.findById(row.caseId);
      if (caseItem) {
        return caseItem.id;
      }
    }

    if (row.marketHashName) {
      return (
        await this.caseRepository.findOrCreateByMarketHashName(
          row.marketHashName,
        )
      ).id;
    }

    throw new Error(
      `Dòng ${index + 2}: không tìm thấy case. Hãy nhập Case ID hoặc Market Hash Name đúng.`,
    );
  }
}
