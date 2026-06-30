const CSFLOAT_API = "https://api.csgofloat.com";
const TIMEOUT_MS = 10_000;

export type CSFloatResponse = {
  iteminfo?: {
    paintseed?: number;
    floatvalue?: number;
    paintindex?: number;
    origin?: number;
    defindex?: number;
    stickers?: Array<{ slot: number; sticker_id: number; wear?: number }>;
  };
};

export async function inspectItem(
  inspectLink: string,
): Promise<CSFloatResponse | null> {
  const url = `${CSFLOAT_API}/?url=${encodeURIComponent(inspectLink)}`;
  const apiKey = process.env.CSFLOAT_API_KEY;
  const headers: Record<string, string> = { "User-Agent": "CS2Tracker/1.0" };
  if (apiKey) {
    headers["Authorization"] = apiKey;
  }

  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`CSFloat API returned error status: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch from CSFloat API:", err);
    return null;
  }
}
