import { PortfolioReportService } from "@/services/portfolio-report-service";
import { PortfolioImportService } from "@/services/portfolio-import-service";
import { PriceService } from "@/services/price-service";
import { PortfolioService } from "@/services/portfolio-service";
import { MongoCaseRepository } from "./repositories/mongo-case-repository";
import { MongoPortfolioRepository } from "./repositories/mongo-portfolio-repository";
import { MongoPriceSnapshotRepository } from "./repositories/mongo-price-snapshot-repository";
import { SteamMarketPriceProvider } from "./price/steam-market-price-provider";

export function createServices() {
  const caseRepository = new MongoCaseRepository();
  const portfolioRepository = new MongoPortfolioRepository();
  const priceSnapshotRepository = new MongoPriceSnapshotRepository();
  const priceProvider = new SteamMarketPriceProvider();

  const priceService = new PriceService(priceSnapshotRepository, priceProvider);

  const portfolioService = new PortfolioService(portfolioRepository, caseRepository);

  return {
    caseRepository,
    portfolioService,
    portfolioImportService: new PortfolioImportService(portfolioService, caseRepository),
    portfolioReportService: new PortfolioReportService(
      portfolioRepository,
      caseRepository,
      priceService,
      priceSnapshotRepository,
    ),
    priceService,
  };
}
