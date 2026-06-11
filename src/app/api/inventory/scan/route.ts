import { NextResponse } from "next/server";
import { createServices } from "@/infrastructure/container";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { getSteamCaseImageUrl } from "@/infrastructure/cases/steam-case-image-provider";
import { getPortfolioOwnerId } from "@/services/auth-service";
import type { StorageUnitInfo } from "@/domain/storage-unit";
import { parseSteamCookies, resolveSteamId } from "@/utils/steam";
import { USER_AGENTS } from "@/utils/api-client";

export const dynamic = "force-dynamic";

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
    Date.UTC(
      nowVN.getUTCFullYear(),
      nowVN.getUTCMonth(),
      nowVN.getUTCDate(),
      14,
      0,
      0,
      0,
    ),
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
  await col
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    .catch(() => {});
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
  marketScanWarning?: boolean;
  storageUnits?: StorageUnitInfo[];
  hasCookie?: boolean;
};

type SteamProfile = {
  name: string;
  avatarUrl: string | null;
};

const STEAM_IMAGE_CDN =
  "https://community.cloudflare.steamstatic.com/economy/image";

type ScanItem = {
  caseItem: {
    id: string;
    name: string;
    marketHashName: string;
    imageUrl: string | null;
    isActive: boolean;
  };
  type: "Case" | "Capsule" | "Sticker" | "Skin";
  rarity?: {
    name: string;
    color: string;
  };
  steamMarketUrl?: string;
  quantity: number;
  price: number;
  total: number;
  holdDays?: number;
  onMarket?: boolean;
  tradeProtected?: boolean;
};

function cleanDateString(str: string): string {
  return str.replace(/[()]/g, "").trim();
}

function analyzeItemStatus(desc: {
  descriptions?: Array<{ value: string }>;
  owner_descriptions?: Array<{ value: string }>;
}): { holdDays: number; tradeProtected: boolean } {
  const allDescs = [
    ...(desc.descriptions || []),
    ...(desc.owner_descriptions || []),
  ];
  let holdDays = 0;
  let tradeProtected = false;

  for (const d of allDescs) {
    const val = d.value || "";
    const lowercaseVal = val.toLowerCase();

    const isHoldKeyword = lowercaseVal.includes("tradable after");
    const isProtectedKeyword =
      lowercaseVal.includes("trade-protected") ||
      lowercaseVal.includes("trade protected") ||
      lowercaseVal.includes("reversed by the sender");

    if (isHoldKeyword || isProtectedKeyword) {
      if (isProtectedKeyword) {
        tradeProtected = true;
      }

      let dateStr = "";
      if (lowercaseVal.includes("after")) {
        dateStr = val.substring(lowercaseVal.indexOf("after") + 5);
      } else if (lowercaseVal.includes("until")) {
        dateStr = val.substring(lowercaseVal.indexOf("until") + 5);
      } else if (lowercaseVal.includes("on")) {
        dateStr = val.substring(lowercaseVal.indexOf("on") + 2);
      }

      if (dateStr) {
        const cleaned = cleanDateString(dateStr);
        const holdDate = new Date(cleaned);
        if (!isNaN(holdDate.getTime())) {
          const diffMs = holdDate.getTime() - Date.now();
          if (diffMs > 0) {
            holdDays = Math.max(
              holdDays,
              Math.ceil(diffMs / (24 * 60 * 60 * 1000)),
            );
          }
        }
      } else if (isProtectedKeyword) {
        // If it's a protected keyword but we couldn't parse a date, mark it as protected anyway
        tradeProtected = true;
      }
    }
  }

  return { holdDays, tradeProtected };
}

async function getCachedScan(
  steamId64: string,
  ignoreExpiry = false,
): Promise<CachedScanResult | null> {
  const db = await getDatabase();
  const query: Record<string, unknown> = { steamId64 };
  if (!ignoreExpiry) {
    query.expiresAt = { $gt: new Date() };
  }
  const doc = await db.collection(COLLECTION_NAME).findOne(query);
  return doc as CachedScanResult | null;
}

async function saveScanToCache(result: CachedScanResult): Promise<void> {
  const db = await getDatabase();
  await db
    .collection(COLLECTION_NAME)
    .updateOne(
      { steamId64: result.steamId64 },
      { $set: result },
      { upsert: true },
    );
}

// ─── Background Jobs implementation ──────────────────────────────────────────

type ScanJob = {
  id: string;
  status: "queued" | "running" | "done" | "error";
  percent: number;
  message: string;
  stage?: string;
  result?: unknown;
  error?: string;
  detail?: unknown;
  createdAt: string;
  updatedAt: string;
};

const scanJobs = getScanJobs();

function getScanJobs(): Map<string, ScanJob> {
  const globalStore = globalThis as typeof globalThis & {
    __cs2InventoryScanJobs?: Map<string, ScanJob>;
  };
  globalStore.__cs2InventoryScanJobs ??= new Map<string, ScanJob>();
  return globalStore.__cs2InventoryScanJobs;
}

function updateScanJob(jobId: string, update: Partial<ScanJob>) {
  const current = scanJobs.get(jobId);
  if (!current) return;
  scanJobs.set(jobId, {
    ...current,
    ...update,
    updatedAt: new Date().toISOString(),
  });
}

function extractSteamIdFromCookie(cookieValue: string): string | null {
  try {
    const decoded = decodeURIComponent(cookieValue);

    // 1. Try to extract from JWT subject (most reliable for steamLoginSecure)
    const dotIndex = decoded.indexOf(".");
    if (dotIndex !== -1) {
      const jwtSubParts = decoded.split(".");
      if (jwtSubParts.length >= 2) {
        const payloadBase64 = jwtSubParts[1];
        const payloadJson = Buffer.from(
          payloadBase64.replace(/-/g, "+").replace(/_/g, "/"),
          "base64",
        ).toString("utf8");
        const payload = JSON.parse(payloadJson);
        if (payload && payload.sub && /^\d{17}$/.test(payload.sub)) {
          return payload.sub;
        }
      }
    }
  } catch (e) {
    // Ignore error and fallback
  }

  // 2. Fallback to extracting from the prefix before "||"
  try {
    const decoded = decodeURIComponent(cookieValue);
    const parts = decoded.split(/[|%]+/);
    return parts[0] && /^\d{17}$/.test(parts[0]) ? parts[0] : null;
  } catch (e) {
    return null;
  }
}

async function runScanJob(
  jobId: string,
  params: {
    steamUrl: string;
    steamCookie?: string;
    forceRefresh?: boolean;
    ownerId?: string;
  },
) {
  const { steamUrl, steamCookie, forceRefresh, ownerId } = params;
  let steamId64: string | undefined;
  try {
    updateScanJob(jobId, {
      status: "running",
      percent: 5,
      message: "Đang định dạng link Steam...",
    });

    // Step 1: Resolve to SteamID64 + profile info
    let profile: SteamProfile;
    try {
      const resolved = await resolveSteamId(steamUrl);
      steamId64 = resolved.steamId64;
      profile = resolved.profile;
    } catch (err) {
      throw new Error(
        err instanceof Error ? err.message : "Link Steam không hợp lệ.",
      );
    }

    updateScanJob(jobId, { percent: 15, message: "Kiểm tra cache..." });

    // Step 2: Check cache (unless force refresh)
    await ensureCacheIndexes();

    if (!forceRefresh) {
      const cached = await getCachedScan(steamId64);
      if (cached) {
        const requestHasCookie = !!steamCookie && steamCookie.trim().length > 0;
        const cacheHasCookie = !!cached.hasCookie;

        if (
          requestHasCookie === cacheHasCookie ||
          (!requestHasCookie && cacheHasCookie)
        ) {
          updateScanJob(jobId, {
            status: "done",
            percent: 100,
            message: "Hoàn tất quét (từ cache)",
            result: {
              steamId64: cached.steamId64,
              profile: cached.profile ?? profile,
              items: cached.items,
              totalPrice: cached.totalPrice,
              totalQuantity: cached.totalQuantity,
              totalInventoryCount: cached.totalInventoryCount,
              cached: true,
              scannedAt: cached.scannedAt,
              expiresAt: cached.expiresAt,
              marketScanWarning: cached.marketScanWarning,
              storageUnits: cached.storageUnits ?? [],
            },
          });
          return;
        }
      }
    }

    // Step 2.5: Validate Cookie if provided
    let hasCookie = false;
    let cookieValue = "";
    let parentalCookie = "";
    let sessionidCookie = "";
    if (steamCookie && steamCookie.trim()) {
      updateScanJob(jobId, {
        percent: 20,
        message: "Kiểm tra cấu hình cookie...",
      });
      const parsed = parseSteamCookies(steamCookie);
      cookieValue = parsed.steamLoginSecure;
      parentalCookie = parsed.steamparental || "";
      sessionidCookie = parsed.sessionid || "";

      const cookieSteamId = extractSteamIdFromCookie(cookieValue);
      if (!cookieSteamId) {
        throw new Error("Cookie steamLoginSecure không đúng định dạng.");
      }
      if (cookieSteamId !== steamId64) {
        throw new Error(
          `Cookie này thuộc về tài khoản Steam khác (${cookieSteamId}), không trùng khớp với tài khoản bạn đang cấu hình (${steamId64}).`,
        );
      }

      // Pre-flight check: make sure the cookie is actually alive
      // Steam redirects to /login/home if the cookie is expired/invalid
      let fullCookieHeader = `steamLoginSecure=${cookieValue}`;
      if (parentalCookie) {
        fullCookieHeader += `; steamparental=${parentalCookie}`;
      }
      if (sessionidCookie) {
        fullCookieHeader += `; sessionid=${sessionidCookie}`;
      }

      const validateRes = await fetch(
        "https://steamcommunity.com/my/inventory",
        {
          headers: {
            "User-Agent": USER_AGENTS.steamBrowser,
            Cookie: fullCookieHeader,
          },
          redirect: "manual", // Don't follow redirect, we want to see the 302
        },
      );

      if (validateRes.status === 302) {
        const location = validateRes.headers.get("location") || "";
        if (location.includes("/login/")) {
          // Clear invalid cookie in database and set cookieError if ownerId exists
          if (ownerId) {
            const db = await getDatabase();
            await db
              .collection("portfolio_accounts")
              .updateOne(
                { steamId64, ownerId },
                {
                  $set: {
                    steamCookie: "",
                    cookieError:
                      "Cookie steamLoginSecure đã hết hạn hoặc không hợp lệ. Vui lòng lấy cookie mới trên Steam.",
                  },
                },
              );
          }
          throw new Error(
            "Cookie steamLoginSecure đã hết hạn hoặc không hợp lệ. Vui lòng lấy cookie mới trên Steam.",
          );
        }
      } else if (validateRes.status === 403) {
        // Family View is active. We don't throw an error here anymore, because the actual
        // JSON API fetch below might still succeed if the provided `steamparental` is correct.
        console.warn(
          `[InventoryScanner] /my/inventory returned 403 (Family View). Proceeding to actual fetch...`,
        );
      }

      hasCookie = true;
    }

    updateScanJob(jobId, {
      percent: 30,
      message: "Bắt đầu quét hòm đồ từ Steam...",
    });

    // Step 3: Fetch inventory with pagination (Steam max ~2000 per request)
    const steamHeaders: Record<string, string> = {
      "User-Agent": USER_AGENTS.steamBrowser,
      Referer: `https://steamcommunity.com/profiles/${steamId64}/inventory/`,
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
    };

    if (hasCookie) {
      let fullCookieHeader = `steamLoginSecure=${cookieValue}`;
      if (parentalCookie) {
        fullCookieHeader += `; steamparental=${parentalCookie}`;
      }
      if (sessionidCookie) {
        fullCookieHeader += `; sessionid=${sessionidCookie}`;
      }
      steamHeaders["Cookie"] = fullCookieHeader;
    }

    const allAssets: Array<{
      classid: string;
      instanceid: string;
      amount: string;
      assetid: string;
    }> = [];
    const allDescriptions: Array<{
      classid: string;
      instanceid: string;
      name?: string;
      market_hash_name: string;
      marketable: number;
      type: string;
      icon_url?: string;
      tags?: Array<{
        category?: string;
        internal_name?: string;
        localized_tag_name?: string;
        color?: string;
      }>;
      owner_descriptions?: Array<{
        type: string;
        value: string;
        color?: string;
      }>;
      descriptions?: Array<{
        type: string;
        value: string;
        color?: string;
      }>;
    }> = [];
    let totalInventoryCount = 0;
    const contexts = [2];
    if (hasCookie) {
      contexts.push(16);
    }

    // Paginate through inventory contexts
    for (const contextId of contexts) {
      let startAssetId: string | undefined;
      let contextTotalAdded = false;

      for (let page = 0; page < 20; page++) {
        updateScanJob(jobId, {
          percent: 30 + Math.min(page * 2, 20) + (contextId === 16 ? 10 : 0),
          message: `Đang tải hòm đồ (nhóm ${contextId === 2 ? "thường" : "tạm khóa"}, trang ${page + 1})...`,
        });

        let inventoryUrl = `https://steamcommunity.com/inventory/${steamId64}/730/${contextId}?l=english&count=2000`;
        if (startAssetId) {
          inventoryUrl += `&start_assetid=${startAssetId}`;
        }

        const response = await fetch(inventoryUrl, { headers: steamHeaders });

        if (response.status === 403) {
          if (contextId === 16) {
            console.error(
              "Context 16 returned 403 Forbidden. Skipping trade-protected items.",
            );
            break;
          }
          if (hasCookie) {
            // Fallback: try fetching without Cookie to check if the inventory is public
            const fallbackHeaders = { ...steamHeaders };
            delete fallbackHeaders["Cookie"];
            const fallbackRes = await fetch(inventoryUrl, {
              headers: fallbackHeaders,
            });

            // Clear invalid cookie in database
            if (ownerId) {
              const db = await getDatabase();
              await db
                .collection("portfolio_accounts")
                .updateOne(
                  { steamId64, ownerId },
                  {
                    $set: {
                      steamCookie: "",
                      cookieError: fallbackRes.ok
                        ? "Tài khoản đang bật Family View. Vui lòng cung cấp cookie steamparental chính xác."
                        : "Hòm đồ đang để ẩn (Private). Vui lòng cấu hình cookie steamLoginSecure chính xác.",
                    },
                  },
                );
            }

            if (fallbackRes.ok) {
              const debugInfo = `[Debug: steamLoginSecure=${cookieValue ? `${cookieValue.substring(0, 5)}...${cookieValue.slice(-5)}` : "empty"}, steamparental=${parentalCookie ? `${parentalCookie.substring(0, 5)}...${parentalCookie.slice(-5)}` : "empty"}, sessionid=${sessionidCookie || "empty"}]`;
              throw new Error(
                `Cookie đã bị từ chối (403). Tài khoản đang bật Family View. Vui lòng tắt Family View hoặc đảm bảo bạn đã nhập đúng cookie \`steamparental\` (Lưu ý: Không phải mã PIN 4 số, mà là chuỗi cookie lấy từ DevTools F12). ${debugInfo}`,
              );
            } else {
              throw new Error(
                "Hòm đồ đang để ẩn (Private). Vui lòng cấu hình cookie steamLoginSecure chính xác để quét.",
              );
            }
          } else {
            throw new Error(
              "Profile này đang để ẩn (Private Inventory). Không thể quét hòm đồ. Nếu là hòm đồ của bạn, hãy nhập cookie steamLoginSecure để quét.",
            );
          }
        }

        if (!response.ok) {
          if (contextId === 16) {
            console.error(
              `Context 16 returned status ${response.status}. Skipping.`,
            );
            break;
          }
          if (allAssets.length > 0) break;
          throw new Error(
            `Steam trả về lỗi HTTP ${response.status}. Thử lại sau.`,
          );
        }

        const data = await response.json();

        if (data.success === false || data.success === 0) {
          if (contextId === 16) {
            console.error(`Context 16 returned success = false. Skipping.`);
            break;
          }
          if (allAssets.length > 0) break;
          throw new Error(
            data.Error || "Profile đang bị khóa (Private) hoặc không tồn tại.",
          );
        }

        if (data.assets) allAssets.push(...data.assets);
        if (data.descriptions) allDescriptions.push(...data.descriptions);

        if (data.total_inventory_count && !contextTotalAdded) {
          totalInventoryCount += data.total_inventory_count;
          contextTotalAdded = true;
        }

        if (!data.more_items || !data.last_assetid) break;
        startAssetId = data.last_assetid;
      }
    }

    // Step 4.5: Scan items currently listed for sale on Steam Market
    let marketScanWarning = !hasCookie;
    if (hasCookie) {
      try {
        let start = 0;
        const count = 100;
        let hasMoreListings = true;
        let success = true;

        while (hasMoreListings) {
          const marketScanCount = allAssets.filter(
            (a) => (a as any).onMarket,
          ).length;
          updateScanJob(jobId, {
            percent: 52,
            message: `Đang quét vật phẩm trên Market (đã tìm thấy ${marketScanCount} item)...`,
          });

          const marketUrl = `https://steamcommunity.com/market/mylistings?norender=1&start=${start}&count=${count}`;
          const marketRes = await fetch(marketUrl, { headers: steamHeaders });
          if (!marketRes.ok) {
            console.error(
              `Steam Market listings error: HTTP ${marketRes.status}`,
            );
            success = false;
            break;
          }

          const marketData = await marketRes.json();
          if (!marketData || marketData.success === false) {
            console.error("Steam Market listings success = false");
            success = false;
            break;
          }

          const listings = marketData.listings || [];
          const assets = marketData.assets || {};
          const cs2Assets = assets["730"]?.["2"] || {};

          for (const listing of listings) {
            const asset = listing.asset;
            if (asset && asset.appid === 730) {
              const assetId = asset.id;
              const assetDetail = cs2Assets[assetId];

              if (assetDetail) {
                allAssets.push({
                  classid: assetDetail.classid,
                  instanceid: assetDetail.instanceid,
                  amount: asset.amount || "1",
                  assetid: assetId,
                  onMarket: true,
                } as any);

                const key = `${assetDetail.classid}_${assetDetail.instanceid}`;
                if (
                  !allDescriptions.some(
                    (d) => `${d.classid}_${d.instanceid}` === key,
                  )
                ) {
                  allDescriptions.push({
                    classid: assetDetail.classid,
                    instanceid: assetDetail.instanceid,
                    name: assetDetail.name,
                    market_hash_name:
                      assetDetail.market_hash_name || assetDetail.name,
                    marketable: 1,
                    type: assetDetail.type || "",
                    icon_url: assetDetail.icon_url,
                    tags: assetDetail.tags,
                  });
                }
              }
            }
          }

          if (
            listings.length < count ||
            start + listings.length >= marketData.total_count
          ) {
            hasMoreListings = false;
          } else {
            start += listings.length;
          }
        }

        if (success) {
          marketScanWarning = false;
        } else {
          marketScanWarning = true;
        }
      } catch (err) {
        console.error("Failed to fetch market listings:", err);
        marketScanWarning = true;
      }
    }

    if (allAssets.length === 0) {
      throw new Error("Hòm đồ không có item nào hoặc đang bị ẩn.");
    }

    updateScanJob(jobId, {
      percent: 55,
      message: "Đang phân tích các item...",
    });

    const itemCounts: Record<string, { count: number; onMarket: boolean }> = {};
    for (const asset of allAssets) {
      const statusSuffix = (asset as any).onMarket ? "_onMarket" : "_normal";
      const key = `${asset.classid}_${asset.instanceid}${statusSuffix}`;
      const amount = parseInt(asset.amount, 10) || 1;

      if (!itemCounts[key]) {
        itemCounts[key] = { count: 0, onMarket: !!(asset as any).onMarket };
      }
      itemCounts[key].count += amount;
    }

    const descMap = new Map<string, (typeof allDescriptions)[0]>();
    for (const desc of allDescriptions) {
      const key = `${desc.classid}_${desc.instanceid}`;
      if (!descMap.has(key)) descMap.set(key, desc);
    }

    const cs2Items: Record<
      string,
      {
        marketHashName: string;
        count: number;
        itemType: "Case" | "Capsule" | "Sticker" | "Skin";
        iconUrl: string | null;
        rarity?: { name: string; color: string };
        holdDays: number;
        tradeProtected: boolean;
        onMarket: boolean;
      }
    > = {};

    // Detect Storage Units before processing tradeable items
    const storageUnits: StorageUnitInfo[] = [];

    for (const [key, info] of Object.entries(itemCounts)) {
      const parts = key.split("_");
      const classid = parts[0];
      const instanceid = parts[1];
      const descKey = `${classid}_${instanceid}`;

      const desc = descMap.get(descKey);
      if (!desc) continue;

      // Detect Storage Unit: checks market_hash_name, type, or description text (handles renamed storage units)
      const isStorageUnit = (() => {
        if (desc.market_hash_name === "Storage Unit") return true;
        if (desc.type?.toLowerCase().includes("storage container")) return true;
        if (desc.market_hash_name?.toLowerCase().includes("storage container"))
          return true;

        // A renamed Storage Unit retains its "Tool" type and standard description text
        const isTool =
          desc.type?.toLowerCase().includes("tool") ||
          desc.tags?.some(
            (t: any) =>
              t.category === "Type" &&
              t.internal_name?.toLowerCase().includes("tool"),
          );

        const hasStorageText =
          desc.descriptions?.some(
            (d: any) =>
              d.value?.toLowerCase().includes("storage unit") &&
              d.value?.toLowerCase().includes("1,000"),
          ) ||
          desc.owner_descriptions?.some(
            (d: any) =>
              d.value?.toLowerCase().includes("storage unit") &&
              d.value?.toLowerCase().includes("1,000"),
          );

        return Boolean(isTool && hasStorageText);
      })();

      if (isStorageUnit) {
        const relatedAssets = allAssets.filter(
          (a) => a.classid === classid && a.instanceid === instanceid,
        );
        for (const asset of relatedAssets) {
          storageUnits.push({
            assetId: asset.assetid,
            name: desc.name || "Storage Unit",
            iconUrl: desc.icon_url
              ? `${STEAM_IMAGE_CDN}/${desc.icon_url}/360fx360f`
              : null,
          });
        }
        continue;
      }

      const { holdDays, tradeProtected } = analyzeItemStatus(desc);
      const isTradeLocked = holdDays > 0;
      const isSpecialState = isTradeLocked || tradeProtected || info.onMarket;

      const nameLower = desc.market_hash_name?.toLowerCase() || "";
      const typeLower = desc.type?.toLowerCase() || "";
      const isKey =
        nameLower.includes("key") &&
        (nameLower.includes("case") ||
          nameLower.includes("capsule") ||
          nameLower.includes("sticker") ||
          typeLower.includes("key"));

      if (!desc.marketable && !isSpecialState && !isKey) continue;

      let itemType: "Case" | "Capsule" | "Sticker" | "Skin" = "Skin";
      if (nameLower.includes("capsule") || nameLower.includes("package")) {
        itemType = "Capsule";
      } else if (nameLower.includes("sticker")) {
        itemType = "Sticker";
      } else if (
        nameLower.includes("case") ||
        typeLower.includes("container")
      ) {
        itemType = "Case";
      }

      let rarity: { name: string; color: string } | undefined;
      if (desc.tags) {
        const rarityTag = desc.tags.find((t) => t.category === "Rarity");
        if (rarityTag && rarityTag.localized_tag_name) {
          rarity = {
            name: rarityTag.localized_tag_name,
            color: rarityTag.color ? `#${rarityTag.color}` : "#b0c3d9",
          };
        }
      }

      const cs2Key = `${desc.market_hash_name}_${info.onMarket ? "onMarket" : tradeProtected ? "tradeProtected" : holdDays > 0 ? "hold" : "normal"}`;

      if (!cs2Items[cs2Key]) {
        cs2Items[cs2Key] = {
          marketHashName: desc.market_hash_name,
          count: 0,
          itemType,
          iconUrl: desc.icon_url ?? null,
          rarity,
          holdDays,
          tradeProtected,
          onMarket: info.onMarket,
        };
      } else {
        cs2Items[cs2Key].holdDays = Math.max(
          cs2Items[cs2Key].holdDays,
          holdDays,
        );
      }
      cs2Items[cs2Key].count += info.count;
    }

    updateScanJob(jobId, { percent: 65, message: "Đang lấy thông tin giá..." });

    const { caseRepository, priceService } = createServices();
    const items: ScanItem[] = [];
    let totalPrice = 0;
    let totalQuantity = 0;

    const cs2Keys = Object.keys(cs2Items);
    let lastFetchedFromSteam = false;
    for (let i = 0; i < cs2Keys.length; i++) {
      const cs2Key = cs2Keys[i];
      const {
        marketHashName,
        count,
        itemType,
        iconUrl,
        rarity,
        holdDays,
        tradeProtected,
        onMarket,
      } = cs2Items[cs2Key];
      const percent = 65 + Math.round((i / cs2Keys.length) * 30);
      updateScanJob(jobId, {
        percent,
        message: `Đang định giá: ${marketHashName}`,
      });

      const caseItem =
        await caseRepository.findByMarketHashName(marketHashName);
      let price = 0;
      let imageUrl: string | null = null;

      if (lastFetchedFromSteam) {
        await new Promise((r) => setTimeout(r, 500));
        lastFetchedFromSteam = false;
      }

      if (caseItem) {
        const priceSnapshot = await priceService.getCurrentPrice(caseItem);
        price = priceSnapshot?.price || 0;
        imageUrl = caseItem.imageUrl ?? null;
        lastFetchedFromSteam = true;
      } else {
        const virtualItem = {
          id: `ext_${marketHashName}`,
          name: marketHashName,
          marketHashName,
          isActive: false,
        };
        try {
          const priceSnapshot = await priceService.getCurrentPrice(virtualItem);
          price = priceSnapshot?.price || 0;
        } catch {
          /* ignore */
        }

        if (iconUrl) {
          imageUrl = `${STEAM_IMAGE_CDN}/${iconUrl}/360fx360f`;
        } else {
          try {
            imageUrl = await getSteamCaseImageUrl(marketHashName);
          } catch {
            /* ignore */
          }
        }
        lastFetchedFromSteam = true;
      }

      items.push({
        caseItem: caseItem
          ? { ...caseItem, imageUrl: caseItem.imageUrl ?? null }
          : {
              id: `ext_${marketHashName}`,
              name: marketHashName,
              marketHashName,
              imageUrl,
              isActive: false,
            },
        type: itemType,
        rarity,
        steamMarketUrl: `https://steamcommunity.com/market/listings/730/${encodeURIComponent(marketHashName)}`,
        quantity: count,
        price,
        total: price * count,
        holdDays: holdDays > 0 ? holdDays : undefined,
        tradeProtected: tradeProtected || undefined,
        onMarket: onMarket || undefined,
      });

      totalPrice += price * count;
      totalQuantity += count;
    }

    const finalTotalInventoryCount = totalInventoryCount || allAssets.length;
    const now = new Date();
    const expiresAt = getNextExpiry();

    updateScanJob(jobId, { percent: 98, message: "Lưu kết quả quét..." });

    await saveScanToCache({
      steamId64,
      profile,
      items,
      totalPrice,
      totalQuantity,
      totalInventoryCount: finalTotalInventoryCount,
      scannedAt: now,
      expiresAt,
      marketScanWarning,
      storageUnits,
      hasCookie,
    } as CachedScanResult);

    if (hasCookie && ownerId) {
      try {
        const db = await getDatabase();
        await db
          .collection("portfolio_accounts")
          .updateOne({ steamId64, ownerId }, { $set: { cookieError: null } });
      } catch {
        /* ignore */
      }
    }

    updateScanJob(jobId, {
      status: "done",
      percent: 100,
      message: "Hoàn tất quét!",
      result: {
        steamId64,
        profile,
        items,
        totalPrice,
        totalQuantity,
        totalInventoryCount: finalTotalInventoryCount,
        cached: false,
        scannedAt: now,
        expiresAt,
        marketScanWarning,
        storageUnits,
      },
    });
  } catch (err) {
    console.error("Scan job error:", err);
    if (ownerId && steamId64) {
      const isCookieError =
        err instanceof Error &&
        (err.message.includes("Cookie") ||
          err.message.includes("cookie") ||
          err.message.includes("hòm đồ đang để ẩn") ||
          err.message.includes("Family View"));
      if (isCookieError) {
        try {
          const db = await getDatabase();
          await db
            .collection("portfolio_accounts")
            .updateOne(
              { steamId64, ownerId },
              { $set: { cookieError: err.message } },
            );
        } catch {
          /* ignore */
        }
      }
    }

    if (steamId64) {
      try {
        const expiredCache = await getCachedScan(steamId64, true);
        if (expiredCache) {
          console.warn(
            `[InventoryScanner] Live scan failed, falling back to cache for ${steamId64}. Error:`,
            err,
          );
          updateScanJob(jobId, {
            status: "done",
            percent: 100,
            message:
              "Không thể kết nối đến Steam, sử dụng dữ liệu cũ từ cache.",
            result: {
              steamId64: expiredCache.steamId64,
              profile: expiredCache.profile,
              items: expiredCache.items,
              totalPrice: expiredCache.totalPrice,
              totalQuantity: expiredCache.totalQuantity,
              totalInventoryCount: expiredCache.totalInventoryCount,
              cached: true,
              scannedAt: expiredCache.scannedAt,
              expiresAt: expiredCache.expiresAt,
              marketScanWarning: expiredCache.marketScanWarning,
              storageUnits: expiredCache.storageUnits ?? [],
            },
          });
          return;
        }
      } catch (fallbackErr) {
        console.error("Failed to fetch expired cache fallback:", fallbackErr);
      }
    }

    updateScanJob(jobId, {
      status: "error",
      percent: 100,
      message:
        err instanceof Error ? err.message : "Có lỗi xảy ra khi quét hòm đồ.",
      error:
        err instanceof Error ? err.message : "Có lỗi xảy ra khi quét hòm đồ.",
    });
  }
}

// ─── Main handlers ───────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ message: "Thiếu jobId." }, { status: 400 });
  }

  const job = scanJobs.get(jobId);
  if (!job) {
    return NextResponse.json(
      { message: "Không tìm thấy job." },
      { status: 404 },
    );
  }

  return NextResponse.json(job);
}

export async function POST(request: Request) {
  try {
    const ownerId = await getPortfolioOwnerId().catch(() => "guest");
    const body = await request.json();
    const { steamUrl, steamCookie, forceRefresh, progress } = body;

    if (!steamUrl || typeof steamUrl !== "string" || !steamUrl.trim()) {
      return NextResponse.json(
        { message: "Vui lòng cung cấp link Steam." },
        { status: 400 },
      );
    }

    if (progress) {
      const jobId = Math.random().toString(36).substring(7);
      scanJobs.set(jobId, {
        id: jobId,
        status: "queued",
        percent: 0,
        message: "Đang chờ quét...",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Run background job asynchronously
      runScanJob(jobId, { steamUrl, steamCookie, forceRefresh, ownerId });

      return NextResponse.json({ jobId });
    }

    // Sync flow (fallback/fallback client)
    const jobId = Math.random().toString(36).substring(7);
    scanJobs.set(jobId, {
      id: jobId,
      status: "queued",
      percent: 0,
      message: "Đang chờ quét...",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await runScanJob(jobId, { steamUrl, steamCookie, forceRefresh, ownerId });
    const job = scanJobs.get(jobId);

    if (job?.status === "error") {
      return NextResponse.json({ message: job.error }, { status: 400 });
    }
    return NextResponse.json(job?.result);
  } catch (error) {
    console.error("Scan route error:", error);
    return NextResponse.json(
      { message: "Có lỗi xảy ra khi quét hòm đồ. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}
