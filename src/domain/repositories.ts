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
  findByMarketHashName(marketHashName: string): Promise<CaseItem | null>;
  findOrCreateByMarketHashName(marketHashName: string): Promise<CaseItem>;
  findByIds(ids: string[]): Promise<CaseItem[]>;
}

export interface PortfolioRepository {
  list(): Promise<PortfolioItem[]>;
  create(input: CreatePortfolioItemInput): Promise<PortfolioItem>;
  createMany(inputs: CreatePortfolioItemInput[]): Promise<PortfolioItem[]>;
  update(
    id: string,
    input: UpdatePortfolioItemInput,
  ): Promise<PortfolioItem | null>;
  delete(id: string): Promise<boolean>;
  deleteMany(ids: string[]): Promise<boolean>;
}

export interface PriceSnapshotRepository {
  findLatest(caseId: string): Promise<PriceSnapshot | null>;
  findLatestMany(caseIds: string[]): Promise<Map<string, PriceSnapshot>>;
  findClosestBefore(caseId: string, date: Date): Promise<PriceSnapshot | null>;
  findClosestBeforeMany(
    caseIds: string[],
    date: Date,
  ): Promise<Map<string, PriceSnapshot>>;
  create(input: CurrentPrice): Promise<PriceSnapshot>;
}

export interface StorageUnitRepository {
  list(): Promise<import("./storage-unit").StorageUnit[]>;
}
