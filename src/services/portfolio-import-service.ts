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
};

export class PortfolioImportService {
  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly caseRepository: CaseRepository,
  ) {}

  async importRows(rows: PortfolioImportRowInput[]): Promise<PortfolioImportResult> {
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

    await this.portfolioService.createMany(inputs);

    return {
      importedCount: inputs.length,
    };
  }

  private async resolveCaseId(row: PortfolioImportRowInput, index: number): Promise<string> {
    if (row.caseId) {
      const caseItem = await this.caseRepository.findById(row.caseId);
      if (caseItem) {
        return caseItem.id;
      }
    }

    if (row.marketHashName) {
      const caseItem = await this.caseRepository.findByMarketHashName(row.marketHashName);
      if (caseItem) {
        return caseItem.id;
      }
    }

    throw new Error(`Dòng ${index + 2}: không tìm thấy case. Hãy nhập Case ID hoặc Market Hash Name đúng.`);
  }
}
