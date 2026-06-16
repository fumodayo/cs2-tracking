// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { extractSteamUrl, unescapeHtmlEntities, buildChatGptPrompt, parseFacebookHtmlSource } from "../facebook-parser";

describe("facebook-parser.ts tests", () => {
  describe("extractSteamUrl", () => {
    it("should extract steam profiles and ids properly", () => {
      expect(extractSteamUrl("https://steamcommunity.com/id/gabelogannewell")).toBe("https://steamcommunity.com/id/gabelogannewell/inventory/");
      expect(extractSteamUrl("https://steamcommunity.com/profiles/76561197960287930/inventory")).toBe("https://steamcommunity.com/profiles/76561197960287930/inventory/");
      expect(extractSteamUrl("My ID is gabelogannewell, please check.")).toBeNull();
      expect(extractSteamUrl("steamcommunity.com/id/test")).toBe("https://steamcommunity.com/id/test/inventory/");
      expect(extractSteamUrl("Check my link: https://steamcommunity.com/id/abc/")).toBe("https://steamcommunity.com/id/abc/inventory/");
    });
  });

  describe("unescapeHtmlEntities", () => {
    it("should replace common HTML entities", () => {
      expect(unescapeHtmlEntities("&amp; &lt; &gt; &quot; &#039; &#x2F;")).toBe("& < > \" ' /");
      expect(unescapeHtmlEntities("")).toBe("");
    });
  });

  describe("buildChatGptPrompt", () => {
    it("should build prompt text containing images list", () => {
      const prompt = buildChatGptPrompt("Recoil Case x10", ["http://image1.jpg"]);
      expect(prompt).toContain("Recoil Case x10");
      expect(prompt).toContain("http://image1.jpg");
    });
  });

  describe("parseFacebookHtmlSource", () => {
    it("should parse fields from raw HTML", () => {
      const sampleHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta property="og:description" content="Bán Recoil Case giá tốt. Link steam: https://steamcommunity.com/id/gabelogannewell/" />
          <meta property="og:title" content="John Doe | Facebook" />
          <meta property="og:url" content="https://www.facebook.com/posts/12345" />
          <meta property="article:published_time" content="2026-06-08T14:30:00Z" />
        </head>
        <body>
          <a href="https://www.facebook.com/john.doe">John Doe</a>
        </body>
        </html>
      `;

      const result = parseFacebookHtmlSource(sampleHtml);
      expect(result.text).toBe("Bán Recoil Case giá tốt. Link steam: https://steamcommunity.com/id/gabelogannewell/");
      expect(result.author).toBe("John Doe");
      expect(result.postUrl).toBe("https://www.facebook.com/posts/12345");
      expect(result.steamUrl).toBe("https://steamcommunity.com/id/gabelogannewell/inventory/");
      expect(result.postTime).toContain("08/06/2026");
    });
  });
});
