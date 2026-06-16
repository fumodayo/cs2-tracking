import { describe, it, expect } from "vitest";
import { getSteamResetHour, calculateTradeHoldUntil } from "../date";

describe("Steam Trade Hold Utilities", () => {
  describe("getSteamResetHour", () => {
    it("should return 14 during Seattle DST (PDT) months", () => {
      // June is DST (PDT) -> 14 VN time
      const datePDT = new Date("2026-06-15T10:00:00Z");
      const hour = getSteamResetHour(datePDT);
      expect(hour).toBe(14);
    });

    it("should return 15 during Seattle Standard Time (PST) months", () => {
      // December is Standard Time (PST) -> 15 VN time
      const datePST = new Date("2026-12-15T10:00:00Z");
      const hour = getSteamResetHour(datePST);
      expect(hour).toBe(15);
    });
  });

  describe("calculateTradeHoldUntil", () => {
    it("should calculate correct timezone-aware unlock time for 7-day trade hold (before reset hour)", () => {
      // Buy date: June 15, 2026 at 09:00 AM VN time (before 14:00 VN time reset)
      // 7 days later is June 22. Since 09:00 AM is before 14:00, unlock is on June 22 at 14:00 VN time.
      const buyDate = new Date("2026-06-15T09:00:00+07:00");
      const result = calculateTradeHoldUntil(buyDate, 7);

      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(5); // 0-indexed, so 5 is June
      expect(result.getDate()).toBe(22);
      
      // VN time is UTC+7. Reset hour is 14. So UTC hour should be 14 - 7 = 7.
      expect(result.getUTCHours()).toBe(7);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it("should overflow to day 8 (7 days + 1) if buyDate is after reset hour", () => {
      // Buy date: June 15, 2026 at 15:00 VN time (after 14:00 VN time reset)
      // 7 days later is June 22, but since 15:00 is after 14:00, it unlocks on June 23 at 14:00 VN time.
      const buyDate = new Date("2026-06-15T15:00:00+07:00");
      const result = calculateTradeHoldUntil(buyDate, 7);

      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(5); // June
      expect(result.getDate()).toBe(23);
      expect(result.getUTCHours()).toBe(7); // 14:00 VN time
    });
  });
});
