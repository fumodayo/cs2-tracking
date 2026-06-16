import { describe, it, expect } from "vitest";
import { autoSuggestMapping, parseMatrixWithMapping } from "../portfolio-excel";

describe("portfolio-excel.ts tests", () => {
  describe("autoSuggestMapping", () => {
    it("should auto suggest mapping correctly from exact matches", () => {
      const headers = ["Market Hash Name", "Quantity", "Buy Price", "Buy Date", "Note", "Case ID"];
      const suggested = autoSuggestMapping(headers);

      expect(suggested.name).toBe(0);
      expect(suggested.quantity).toBe(1);
      expect(suggested.buyPrice).toBe(2);
      expect(suggested.buyDate).toBe(3);
      expect(suggested.note).toBe(4);
      expect(suggested.caseId).toBe(5);
    });

    it("should auto suggest mapping using alias checks", () => {
      const headers = ["ten_market", "soluong", "giamua", "ngaymua", "ghichu", "caseid"];
      const suggested = autoSuggestMapping(headers);

      expect(suggested.name).toBe(0);
      expect(suggested.quantity).toBe(1);
      expect(suggested.buyPrice).toBe(2);
      expect(suggested.buyDate).toBe(3);
      expect(suggested.note).toBe(4);
      expect(suggested.caseId).toBe(5);
    });
  });

  describe("parseMatrixWithMapping", () => {
    it("should parse matrix rows using suggested mapping", () => {
      const matrix = [
        ["Ten", "So Luong", "Gia", "Ngay", "Note"],
        ["Recoil Case", "10", "15000", "2026-06-08", "Ghi chu 1"],
        ["Snakebite Case", "5", "12000", "2026-06-09", "Ghi chu 2"],
      ];

      const mapping = {
        name: 0,
        quantity: 1,
        buyPrice: 2,
        buyDate: 3,
        note: 4,
      };

      const parsed = parseMatrixWithMapping(matrix, mapping, 0);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].marketHashName).toBe("Recoil Case");
      expect(parsed[0].quantity).toBe(10);
      expect(parsed[0].buyPrice).toBe(15000);
      expect(parsed[0].buyDate).toBe("2026-06-08");
      expect(parsed[0].note).toBe("Ghi chu 1");

      expect(parsed[1].marketHashName).toBe("Snakebite Case");
      expect(parsed[1].quantity).toBe(5);
      expect(parsed[1].buyPrice).toBe(12000);
      expect(parsed[1].buyDate).toBe("2026-06-09");
      expect(parsed[1].note).toBe("Ghi chu 2");
    });

    it("should handle empty or corrupt cells gracefully", () => {
      const matrix = [
        ["Ten", "So Luong", "Gia", "Ngay", "Note"],
        ["", "10", "15000", "2026-06-08", "Ghi chu 1"], // empty name should be skipped
        ["Snakebite Case", "invalid-qty", "12000", "2026-06-09", "Ghi chu 2"], // invalid qty should default or fall back
      ];

      const mapping = {
        name: 0,
        quantity: 1,
        buyPrice: 2,
        buyDate: 3,
        note: 4,
      };

      const parsed = parseMatrixWithMapping(matrix, mapping, 0);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].marketHashName).toBe("Snakebite Case");
      expect(parsed[0].quantity).toBe(1); // default quantity when parsing fails
      expect(parsed[0].buyPrice).toBe(12000);
    });
  });
});
