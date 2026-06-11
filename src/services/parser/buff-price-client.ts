import { fetchCs2cApi } from "@/utils/api-client";

export async function fetchBuffPriceCny(
  marketHashName: string,
): Promise<number | null> {
  const apiKey = process.env.CS2CAP_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  try {
    const itemsRes = await fetchCs2cApi("/v1/items", {
      method: "POST",
      body: JSON.stringify({ market_hash_names: [marketHashName] }),
    });

    if (!itemsRes.ok) {
      return null;
    }

    const itemsData = await itemsRes.json();
    let itemId: number | null = null;
    if (itemsData && typeof itemsData === "object") {
      const records = collectRecords(itemsData);
      for (const record of records) {
        if (
          record &&
          typeof record === "object" &&
          typeof record.market_hash_name === "string" &&
          record.market_hash_name.toLowerCase() === marketHashName.toLowerCase()
        ) {
          if (typeof record.item_id === "number") {
            itemId = record.item_id;
            break;
          }
        }
      }
    }

    if (itemId === null) {
      return null;
    }

    const params = new URLSearchParams({
      item_id: String(itemId),
      providers: "buff163",
      limit: "5",
      currency: "CNY",
    });

    const pricesRes = await fetchCs2cApi(`/v1/prices?${params}`);

    if (!pricesRes.ok) {
      return null;
    }

    const pricesData = await pricesRes.json();
    if (
      pricesData &&
      typeof pricesData === "object" &&
      pricesData.meta &&
      pricesData.meta.currency === "CNY"
    ) {
      const records = collectRecords(pricesData);
      const record =
        records.find(
          (candidate) =>
            candidate &&
            typeof candidate === "object" &&
            String(candidate.provider ?? "").toLowerCase() === "buff163",
        ) ?? records[0];
      const lowestAsk = record?.lowest_ask;
      if (typeof lowestAsk === "number" && lowestAsk > 0) {
        return lowestAsk / 100;
      }
    }
  } catch (err) {
    console.error(`Error fetching Buff price for ${marketHashName}:`, err);
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function collectRecords(value: unknown): Record<string, any>[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectRecords);
  }

  if (value && typeof value === "object") {
    const nestedRecords = Object.values(value).flatMap(collectRecords);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return [value as Record<string, any>, ...nestedRecords];
  }

  return [];
}
