import { describe, it, expect } from "vitest";
import {
  buildPortfolioTableRows,
  mapTransactionRow,
  getRowSubtype,
  getItemStatusBreakdown,
} from "../portfolio-table-model";
import type { PortfolioReportDto } from "@/types/report";

const mockReport: PortfolioReportDto = {
  summary: {
    totalInvested: 100000,
    totalCurrentValue: 120000,
    totalProfit: 20000,
    totalProfitPercent: 20,
    itemCount: 2,
    caseCount: 2,
  },
  rows: [
    {
      item: {
        id: "item-1",
        caseId: "case-1",
        quantity: 10,
        buyPrice: 10000,
        buyCurrency: "VND",
        buyDate: "2026-01-01",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        note: "Thủ công",
      },
      case: {
        id: "case-1",
        name: "Recoil Case",
        marketHashName: "Recoil Case",
        imageUrl: "http://example.com/recoil.png",
        isActive: true,
      },
      investedValue: 100000,
      currentPrice: 12000,
      currentPriceCapturedAt: "2026-06-15T00:00:00.000Z",
      currentValue: 120000,
      profitAmount: 20000,
      profitPercent: 20,
      marketChanges: {
        "7d": { amount: 5000, percent: 5, baselinePrice: null, baselineDate: null },
        "1m": { amount: 10000, percent: 10, baselinePrice: null, baselineDate: null },
        "3m": { amount: 15000, percent: 15, baselinePrice: null, baselineDate: null },
        "6m": { amount: 20000, percent: 20, baselinePrice: null, baselineDate: null },
        "1y": { amount: 25000, percent: 25, baselinePrice: null, baselineDate: null },
      },
    },
    {
      item: {
        id: "item-2",
        caseId: "case-1",
        quantity: 5,
        buyPrice: 9000,
        buyCurrency: "VND",
        buyDate: "2026-02-01",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
        note: "Inventory Scanner",
      },
      case: {
        id: "case-1",
        name: "Recoil Case",
        marketHashName: "Recoil Case",
        imageUrl: "http://example.com/recoil.png",
        isActive: true,
      },
      investedValue: 45000,
      currentPrice: 12000,
      currentPriceCapturedAt: "2026-06-15T00:00:00.000Z",
      currentValue: 60000,
      profitAmount: 15000,
      profitPercent: 33.33,
      marketChanges: {
        "7d": { amount: 2500, percent: 5, baselinePrice: null, baselineDate: null },
        "1m": { amount: 5000, percent: 10, baselinePrice: null, baselineDate: null },
        "3m": { amount: 7500, percent: 15, baselinePrice: null, baselineDate: null },
        "6m": { amount: 10000, percent: 20, baselinePrice: null, baselineDate: null },
        "1y": { amount: 12500, percent: 25, baselinePrice: null, baselineDate: null },
      },
    },
  ],
};

describe("portfolio-table-model tests", () => {
  describe("mapTransactionRow", () => {
    it("should map row without BUFF price (use Steam)", () => {
      const row = mockReport.rows[0];
      const result = mapTransactionRow(row);

      expect(result.id).toBe("item-1");
      expect(result.quantity).toBe(10);
      expect(result.currentPrice).toBe(12000);
      expect(result.currentValue).toBe(120000);
      expect(result.profitAmount).toBe(20000);
      expect(result.profitPercent).toBe(20);
      expect(result.itemType).toBe("case");
    });

    it("should calculate with BUFF prices when provided", () => {
      const row = mockReport.rows[0];
      const buffPricesCny = { "Recoil Case": 3.5 };
      const buffCnyToVndRate = 3500; // 3.5 * 3500 = 12250 VND

      const result = mapTransactionRow(row, buffPricesCny, buffCnyToVndRate);

      expect(result.currentPrice).toBe(12250);
      expect(result.currentValue).toBe(122500); // 12250 * 10
      expect(result.profitAmount).toBe(22500); // 122500 - 100000
      expect(result.profitPercent).toBe(22.5);
    });
  });

  describe("buildPortfolioTableRows", () => {
    it("should build rows in transactions mode", () => {
      const rows = buildPortfolioTableRows(mockReport, "transactions");
      expect(rows).toHaveLength(2);
      expect(rows[0].id).toBe("item-1"); // Manual rows first
      expect(rows[1].id).toBe("item-2");
    });

    it("should merge rows in case-summary mode", () => {
      const rows = buildPortfolioTableRows(mockReport, "case-summary");
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("case-case-1");
      expect(rows[0].quantity).toBe(15); // 10 + 5
      expect(rows[0].investedValue).toBe(145000); // 100000 + 45000
      expect(rows[0].lotCount).toBe(2);
    });
  });

  describe("getRowSubtype", () => {
    it("should detect Case, Capsule, Sticker properly", () => {
      expect(getRowSubtype({ case: { name: "Recoil Case", marketHashName: "Recoil Case" }, itemType: "case" })).toBe("Case");
      expect(getRowSubtype({ case: { name: "Chao Capsule", marketHashName: "Chao Capsule" }, itemType: "capsule" })).toBe("Capsule");
      expect(getRowSubtype({ case: { name: "Sticker | Gold", marketHashName: "Sticker | Gold" }, itemType: "sticker" })).toBe("Sticker");
    });

    it("should detect Gloves properly", () => {
      const row = {
        case: { name: "★ Sport Gloves | Pandora's Box", marketHashName: "★ Sport Gloves | Pandora's Box" },
        itemType: "skin",
      };
      expect(getRowSubtype(row)).toBe("Gloves");
    });

    it("should detect Knives properly", () => {
      const row = {
        case: { name: "★ Butterfly Knife | Fade", marketHashName: "★ Butterfly Knife | Fade" },
        itemType: "skin",
      };
      expect(getRowSubtype(row)).toBe("Knives");
    });

    it("should detect Agent properly", () => {
      const row = {
        case: { name: "Agent | Number K", marketHashName: "Agent | Number K" },
        itemType: "skin",
      };
      expect(getRowSubtype(row)).toBe("Agent");
    });

    it("should detect Music Kit properly", () => {
      const row = {
        case: { name: "Music Kit | Beartooth", marketHashName: "Music Kit | Beartooth" },
        itemType: "skin",
      };
      expect(getRowSubtype(row)).toBe("Music Kit");
    });

    it("should fallback to weapon name for normal skins", () => {
      const row = {
        case: { name: "AK-47 | Redline", marketHashName: "AK-47 | Redline" },
        itemType: "skin",
      };
      expect(getRowSubtype(row)).toBe("AK-47");
    });
  });

  describe("getItemStatusBreakdown", () => {
    it("should breakdown correctly when sourceAccounts breakdown is present", () => {
      const item = {
        sourceType: "existing",
        quantity: 10,
        tradeHoldUntil: null,
        sourceAccounts: [
          {
            steamId64: "1",
            name: "Acc 1",
            breakdown: { tradeable: 3, onMarket: 2, tradeProtected: 1, hold: 4 },
          },
        ],
      };
      const breakdown = getItemStatusBreakdown(item);
      expect(breakdown.tradeable).toBe(3);
      expect(breakdown.onMarket).toBe(2);
      expect(breakdown.tradeProtected).toBe(1);
      expect(breakdown.hold).toBe(4);
    });

    it("should breakdown based on tradeHoldUntil when sourceAccounts not present", () => {
      const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const item = {
        sourceType: "existing",
        quantity: 5,
        tradeHoldUntil: futureDate,
      };
      const breakdown = getItemStatusBreakdown(item);
      expect(breakdown.hold).toBe(5);
      expect(breakdown.tradeable).toBe(0);
    });
  });
});
