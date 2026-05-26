import { NextResponse } from "next/server";
import { createServices } from "@/infrastructure/container";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { getSteamCaseImageUrl } from "@/infrastructure/cases/steam-case-image-provider";

// ─── Cache helpers ───────────────────────────────────────────────────────────

const COLLECTION_NAME = "inventory_scan_cache";

/**
 * Calculates the next 14:00 (UTC+7) after the current moment.
 * If it's currently before 14:00 today → expires today at 14:00.
 * If it's 14:00 or later → expires tomorrow at 14:00.
 */
function getNextExpiry(): Date {
  const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7
  const now = new Date();

  // Current time in Vietnam
  const nowVN = new Date(now.getTime() + VN_OFFSET_MS);

  // Build "today 14:00" in Vietnam time, then convert back to UTC
  const todayVN14 = new Date(
    Date.UTC(nowVN.getUTCFullYear(), nowVN.getUTCMonth(), nowVN.getUTCDate(), 14, 0, 0, 0),
  );
  // todayVN14 is in "VN wall-clock as UTC", subtract offset to get real UTC
  const todayUtc14 = new Date(todayVN14.getTime() - VN_OFFSET_MS);

  if (now < todayUtc14) {
    return todayUtc14; // today at 14:00 VN
  }
  return new Date(todayUtc14.getTime() + 24 * 60 * 60 * 1000); // tomorrow at 14:00 VN
}

async function ensureCacheIndexes() {
  const db = await getDatabase();
  const col = db.collection(COLLECTION_NAME);
  // TTL index — MongoDB checks every ~60s and deletes docs whose expiresAt < now
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
  await col.createIndex({ steamId64: 1 }).catch(() => {});
}

type CachedScanResult = {
  steamId64: string;
  profile: SteamProfile;
  items: ScanItem[];
  totalPrice: number;
  totalQuantity: number;
  totalInventoryCount: number;
  scannedAt: Date;
  expiresAt: Date;
};

type SteamProfile = {
  name: string;
  avatarUrl: string | null;
};

type ScanItem = {
  caseItem: {
    id: string;
    name: string;
    marketHashName: string;
    imageUrl: string | null;
    isActive: boolean;
  };
  type: "Case" | "Capsule";
  quantity: number;
  price: number;
  total: number;
};

async function getCachedScan(steamId64: string): Promise<CachedScanResult | null> {
  const db = await getDatabase();
  const doc = await db.collection(COLLECTION_NAME).findOne({
    steamId64,
    expiresAt: { $gt: new Date() },
  });
  return doc as CachedScanResult | null;
}

async function saveScanToCache(result: CachedScanResult): Promise<void> {
  const db = await getDatabase();
  await db.collection(COLLECTION_NAME).updateOne(
    { steamId64: result.steamId64 },
    { $set: result },
    { upsert: true },
  );
}

type SteamResolveResult = {
  steamId64: string;
  profile: SteamProfile;
};

/**
 * Resolves a Steam profile URL to a SteamID64 + profile info.
 * Supports:
 *   - Custom URL:  https://steamcommunity.com/id/fumodayo/
 *   - Profile URL: https://steamcommunity.com/profiles/76561198xxxxxxxx/
 *   - Raw SteamID64: 76561198xxxxxxxx
 *   - Raw vanity:    fumodayo
 */
async function resolveSteamId(input: string): Promise<SteamResolveResult> {
  const trimmed = input.trim().replace(/\/+$/, "");

  // Full profile URL with numeric ID
  const profileMatch = trimmed.match(/\/profiles\/(\d{17})/);
  if (profileMatch) {
    const profile = await fetchSteamProfile(`https://steamcommunity.com/profiles/${profileMatch[1]}/?xml=1`);
    return { steamId64: profileMatch[1], profile };
  }

  // Already a SteamID64 (17-digit number)
  const rawId64Match = trimmed.match(/^(\d{17})$/);
  if (rawId64Match) {
    const profile = await fetchSteamProfile(`https://steamcommunity.com/profiles/${rawId64Match[1]}/?xml=1`);
    return { steamId64: rawId64Match[1], profile };
  }

  // Custom URL — extract vanity name
  let vanityName: string | null = null;
  const idMatch = trimmed.match(/\/id\/([^\/]+)/);
  if (idMatch) {
    vanityName = idMatch[1];
  } else if (!trimmed.includes("/")) {
    vanityName = trimmed;
  }

  if (!vanityName) {
    throw new Error("Không thể nhận dạng link Steam. Hãy dán link profile hoặc SteamID64.");
  }

  // Resolve vanity → SteamID64 + profile via XML endpoint
  const xmlUrl = `https://steamcommunity.com/id/${vanityName}/?xml=1`;
  const response = await fetch(xmlUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CS2Tracker/1.0)" },
  });

  if (!response.ok) {
    throw new Error(`Không tìm được profile Steam "${vanityName}" (HTTP ${response.status}).`);
  }

  const xml = await response.text();

  const steamIdMatch = xml.match(/<steamID64>(\d{17})<\/steamID64>/);
  if (!steamIdMatch) {
    throw new Error(`Không tìm thấy SteamID64 cho custom URL "${vanityName}". Profile có thể không tồn tại.`);
  }

  const profile = extractProfileFromXml(xml);
  return { steamId64: steamIdMatch[1], profile };
}

async function fetchSteamProfile(xmlUrl: string): Promise<SteamProfile> {
  try {
    const response = await fetch(xmlUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CS2Tracker/1.0)" },
    });
    if (!response.ok) return { name: "Unknown", avatarUrl: null };
    const xml = await response.text();
    return extractProfileFromXml(xml);
  } catch {
    return { name: "Unknown", avatarUrl: null };
  }
}

function extractProfileFromXml(xml: string): SteamProfile {
  const nameMatch = xml.match(/<steamID><!\[CDATA\[(.+?)\]\]><\/steamID>/);
  const avatarMatch = xml.match(/<avatarMedium><!\[CDATA\[(.+?)\]\]><\/avatarMedium>/);
  return {
    name: nameMatch?.[1] ?? "Unknown",
    avatarUrl: avatarMatch?.[1] ?? null,
  };
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { steamUrl, forceRefresh } = await request.json();

    if (!steamUrl || typeof steamUrl !== "string") {
      return NextResponse.json({ message: "Vui lòng cung cấp link Steam." }, { status: 400 });
    }

    // Step 1: Resolve to SteamID64 + profile info
    let steamId64: string;
    let profile: SteamProfile;
    try {
      const resolved = await resolveSteamId(steamUrl);
      steamId64 = resolved.steamId64;
      profile = resolved.profile;
    } catch (err) {
      return NextResponse.json(
        { message: err instanceof Error ? err.message : "Link Steam không hợp lệ." },
        { status: 400 },
      );
    }

    // Step 2: Check cache (unless force refresh)
    await ensureCacheIndexes();

    if (!forceRefresh) {
      const cached = await getCachedScan(steamId64);
      if (cached) {
        return NextResponse.json({
          steamId64: cached.steamId64,
          profile: cached.profile ?? profile,
          items: cached.items,
          totalPrice: cached.totalPrice,
          totalQuantity: cached.totalQuantity,
          totalInventoryCount: cached.totalInventoryCount,
          cached: true,
          scannedAt: cached.scannedAt,
          expiresAt: cached.expiresAt,
        });
      }
    }

    // Step 3: Fetch inventory with pagination (Steam max ~2000 per request)
    // Steam requires browser-like headers (especially Referer) or it returns 400/403
    const steamHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": `https://steamcommunity.com/profiles/${steamId64}/inventory/`,
      "Accept": "application/json",
      "Accept-Language": "en-US,en;q=0.9",
    };

    const allAssets: Array<{ classid: string; instanceid: string; amount: string; assetid: string }> = [];
    const allDescriptions: Array<{
      classid: string;
      instanceid: string;
      market_hash_name: string;
      marketable: number;
      type: string;
    }> = [];
    let totalInventoryCount = 0;
    let startAssetId: string | undefined;

    // Paginate through inventory
    for (let page = 0; page < 20; page++) {
      let inventoryUrl = `https://steamcommunity.com/inventory/${steamId64}/730/2?l=english&count=2000`;
      if (startAssetId) {
        inventoryUrl += `&start_assetid=${startAssetId}`;
      }

      const response = await fetch(inventoryUrl, { headers: steamHeaders });

      if (response.status === 403) {
        return NextResponse.json(
          { message: "Profile này đang để ẩn (Private Inventory). Không thể quét hòm đồ." },
          { status: 400 },
        );
      }

      if (!response.ok) {
        if (allAssets.length > 0) break;
        return NextResponse.json(
          { message: `Steam trả về lỗi HTTP ${response.status}. Thử lại sau.` },
          { status: 502 },
        );
      }

      const data = await response.json();

      if (data.success === false || data.success === 0) {
        if (allAssets.length > 0) break;
        return NextResponse.json(
          { message: data.Error || "Profile đang bị khóa (Private) hoặc không tồn tại." },
          { status: 400 },
        );
      }

      if (data.assets) allAssets.push(...data.assets);
      if (data.descriptions) allDescriptions.push(...data.descriptions);
      if (data.total_inventory_count) totalInventoryCount = data.total_inventory_count;

      // Check if there are more pages
      if (!data.more_items || !data.last_assetid) break;
      startAssetId = data.last_assetid;
    }

    if (allAssets.length === 0) {
      return NextResponse.json(
        { message: "Hòm đồ không có item nào hoặc đang bị ẩn." },
        { status: 400 },
      );
    }

    // Step 4: Count assets by classid+instanceid
    const itemCounts: Record<string, number> = {};
    for (const asset of allAssets) {
      const key = `${asset.classid}_${asset.instanceid}`;
      const amount = parseInt(asset.amount, 10) || 1;
      itemCounts[key] = (itemCounts[key] || 0) + amount;
    }

    // Build a lookup from descriptions (deduplicate across pages)
    const descMap = new Map<string, (typeof allDescriptions)[0]>();
    for (const desc of allDescriptions) {
      const key = `${desc.classid}_${desc.instanceid}`;
      if (!descMap.has(key)) descMap.set(key, desc);
    }

    // Filter to only CS2 cases/capsules
    const cs2Items: Record<string, { count: number; itemType: "Case" | "Capsule" }> = {};
    for (const [key, count] of Object.entries(itemCounts)) {
      const desc = descMap.get(key);
      if (!desc || !desc.marketable) continue;

      const typeLower = desc.type?.toLowerCase() || "";
      const nameLower = desc.market_hash_name?.toLowerCase() || "";

      let itemType: "Case" | "Capsule" | null = null;

      if (nameLower.includes("capsule") || nameLower.includes("package")) {
        itemType = "Capsule";
      } else if (nameLower.includes("case") || typeLower.includes("container")) {
        itemType = "Case";
      }

      if (itemType) {
        if (!cs2Items[desc.market_hash_name]) {
          cs2Items[desc.market_hash_name] = { count: 0, itemType };
        }
        cs2Items[desc.market_hash_name].count += count;
      }
    }

    // Step 5: Look up prices from our database
    const { caseRepository, priceService } = createServices();
    const items: ScanItem[] = [];
    let totalPrice = 0;
    let totalQuantity = 0;

    const marketHashNames = Object.keys(cs2Items);
    let lastFetchedFromSteam = false;
    for (let i = 0; i < marketHashNames.length; i++) {
      const marketHashName = marketHashNames[i];
      const { count, itemType } = cs2Items[marketHashName];
      const caseItem = await caseRepository.findByMarketHashName(marketHashName);
      let price = 0;
      let imageUrl: string | null = null;

      // Delay before fetching if previous item hit the Steam API (avoid rate limiting)
      if (lastFetchedFromSteam) {
        await new Promise(r => setTimeout(r, 500));
        lastFetchedFromSteam = false;
      }

      if (caseItem) {
        // Item in DB — use priceService with snapshot caching
        const priceSnapshot = await priceService.getCurrentPrice(caseItem);
        price = priceSnapshot?.price || 0;
        imageUrl = caseItem.imageUrl ?? null;
        // priceService internally tracks if it hit Steam or used cache,
        // but we can't tell here — assume it may have fetched
        lastFetchedFromSteam = true;
      } else {
        // Item not in DB (e.g. Autograph Capsules) — still use priceService for caching
        const virtualItem = { id: `ext_${marketHashName}`, name: marketHashName, marketHashName, isActive: false };
        try {
          const priceSnapshot = await priceService.getCurrentPrice(virtualItem);
          price = priceSnapshot?.price || 0;
        } catch { /* ignore price errors */ }
        try {
          imageUrl = await getSteamCaseImageUrl(marketHashName);
        } catch { /* ignore image errors */ }
        lastFetchedFromSteam = true;
      }

      items.push({
        caseItem: caseItem
          ? { ...caseItem, imageUrl: caseItem.imageUrl ?? null }
          : { id: marketHashName, name: marketHashName, marketHashName, imageUrl, isActive: false },
        type: itemType,
        quantity: count,
        price,
        total: price * count,
      });

      totalPrice += price * count;
      totalQuantity += count;
    }

    const finalTotalInventoryCount = totalInventoryCount || allAssets.length;
    const now = new Date();
    const expiresAt = getNextExpiry();

    // Step 6: Save to MongoDB cache
    await saveScanToCache({
      steamId64,
      profile,
      items,
      totalPrice,
      totalQuantity,
      totalInventoryCount: finalTotalInventoryCount,
      scannedAt: now,
      expiresAt,
    });

    return NextResponse.json({
      steamId64,
      profile,
      items,
      totalPrice,
      totalQuantity,
      totalInventoryCount: finalTotalInventoryCount,
      cached: false,
      scannedAt: now,
      expiresAt,
    });
  } catch (error) {
    console.error("Scan error:", error);
    return NextResponse.json(
      { message: "Có lỗi xảy ra khi quét hòm đồ. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}
