import { PortfolioReportService } from "@/services/portfolio-report-service";
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

  return {
    caseRepository,
    portfolioService: new PortfolioService(portfolioRepository, caseRepository),
    portfolioReportService: new PortfolioReportService(
      portfolioRepository,
      caseRepository,
      priceService,
      priceSnapshotRepository,
    ),
    priceService,
  };
}
