import type { CaseItem } from "./case-item";
import type {
  CreatePortfolioItemInput,
  PortfolioItem,
  UpdatePortfolioItemInput,
} from "./portfolio-item";
import type { CurrentPrice, PriceSnapshot } from "./price";

export interface CaseRepository {
  ensureSeeded(): Promise<void>;
  search(query: string): Promise<CaseItem[]>;
  findById(id: string): Promise<CaseItem | null>;
  findByIds(ids: string[]): Promise<CaseItem[]>;
}

export interface PortfolioRepository {
  list(): Promise<PortfolioItem[]>;
  create(input: CreatePortfolioItemInput): Promise<PortfolioItem>;
  update(id: string, input: UpdatePortfolioItemInput): Promise<PortfolioItem | null>;
  delete(id: string): Promise<boolean>;
}

export interface PriceSnapshotRepository {
  findLatest(caseId: string): Promise<PriceSnapshot | null>;
  findClosestBefore(caseId: string, date: Date): Promise<PriceSnapshot | null>;
  create(input: CurrentPrice): Promise<PriceSnapshot>;
}
