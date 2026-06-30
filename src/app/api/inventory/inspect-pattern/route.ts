import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { inspectItem } from "@/services/pattern/csfloat-client";
import {
  decodeInspectLink,
  type DecodedKeychain,
  type DecodedSticker,
} from "@/services/pattern/inspect-link-decoder";
import { analyzePattern } from "@/services/pattern/pattern-analyzer";
import { estimateOverpay } from "@/services/pattern/overpay-calculator";
import { buffPriceRateLimiter } from "@/infrastructure/rate-limiter";
import { fetchBuffPriceCny } from "@/services/parser/buff-price-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for") ||
      (request as NextRequest & { ip?: string }).ip ||
      "unknown-ip";
    const { allowed, retryAfter } = await buffPriceRateLimiter.check(ip);
    if (!allowed) {
      return NextResponse.json(
        { message: "tooManyRequests", details: { retryAfter } },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    const body = await request.json();
    const inspectLink =
      typeof body.inspectLink === "string" ? body.inspectLink.trim() : "";
    const marketHashName =
      typeof body.marketHashName === "string" ? body.marketHashName.trim() : "";
    const existingDopplerPhase =
      typeof body.dopplerPhase === "string" ? body.dopplerPhase.trim() : "";

    if (!inspectLink) {
      return NextResponse.json(
        { message: "missingInspectLink" },
        { status: 400 },
      );
    }

    // 1. Check MongoDB cache
    const db = await getDatabase();
    const cacheCol = db.collection("pattern_inspect_cache");
    const cached = await cacheCol.findOne({ inspectLink });

    if (cached) {
      return NextResponse.json({
        source: "cache",
        patternInfo: cached.patternInfo,
        overpay: cached.overpay,
      });
    }

    // 2. Decode inspect link (Offline first, fallback to CSFloat)
    let paintseed: number | undefined;
    let floatvalue: number | undefined;
    let paintindex: number | undefined;
    let stickers: DecodedSticker[] = [];
    let keychains: DecodedKeychain[] = [];
    let source = "offline-decode";

    const decoded = decodeInspectLink(inspectLink);
    if (decoded) {
      paintseed = decoded.paintSeed;
      floatvalue = decoded.floatValue;
      paintindex = decoded.paintIndex;
      stickers = decoded.stickers;
      keychains = decoded.keychains;
    } else {
      const hasApiKey = !!process.env.CSFLOAT_API_KEY;
      if (hasApiKey) {
        const floatRes = await inspectItem(inspectLink);
        if (floatRes?.iteminfo) {
          paintseed = floatRes.iteminfo.paintseed;
          floatvalue = floatRes.iteminfo.floatvalue;
          paintindex = floatRes.iteminfo.paintindex;
          source = "csfloat";
        }
      }
    }

    if (paintseed === undefined) {
      return NextResponse.json(
        { message: "cannotDecodeInspectLink" },
        { status: 502 },
      );
    }

    // 3. Analyze pattern
    const patternInfo = await analyzePattern(
      marketHashName,
      paintseed,
      floatvalue,
      paintindex,
      existingDopplerPhase,
      { stickers, keychains },
    );

    // 4. Fetch Buff price & calculate overpay
    let overpay = null;
    if (marketHashName) {
      const basePriceCny = await fetchBuffPriceCny(marketHashName);
      if (basePriceCny !== null) {
        overpay = estimateOverpay(patternInfo, basePriceCny);
      }
    }

    // 5. Store in cache
    const doc = {
      inspectLink,
      marketHashName,
      patternInfo,
      overpay,
      scannedAt: new Date(),
    };
    await cacheCol.updateOne({ inspectLink }, { $set: doc }, { upsert: true });

    return NextResponse.json({
      source,
      patternInfo,
      overpay,
    });
  } catch (err) {
    console.error("Error inspecting pattern:", err);
    return NextResponse.json(
      { message: "internalServerError" },
      { status: 500 },
    );
  }
}
