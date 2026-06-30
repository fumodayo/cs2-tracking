export function cleanDateString(str: string): string {
  return str.replace(/[()]/g, "").trim();
}

export function analyzeItemStatus(desc: {
  descriptions?: Array<{ value: string }>;
  owner_descriptions?: Array<{ value: string }>;
}): { holdDays: number; tradeProtected: boolean; tradeHoldUntil?: string } {
  const allDescs = [
    ...(desc.descriptions || []),
    ...(desc.owner_descriptions || []),
  ];
  let holdDays = 0;
  let tradeProtected = false;
  let tradeHoldUntil: string | undefined = undefined;

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
            if (!tradeHoldUntil || holdDate.getTime() > new Date(tradeHoldUntil).getTime()) {
              tradeHoldUntil = holdDate.toISOString();
            }
          }
        }
      } else if (isProtectedKeyword) {
        // If it's a protected keyword but we couldn't parse a date, mark it as protected anyway
        tradeProtected = true;
      }
    }
  }

  return { holdDays, tradeProtected, tradeHoldUntil };
}

export function extractSteamIdFromCookie(cookieValue: string): string | null {
  try {
    let cleanVal = cookieValue.trim().replace(/^["']|["']$/g, "");
    if (cleanVal.toLowerCase().startsWith("steamloginsecure=")) {
      cleanVal = cleanVal.substring(17).trim();
    }
    const decoded = decodeURIComponent(cleanVal);

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
  } catch {
    // Ignore error and fallback
  }

  // 2. Fallback to extracting from the prefix before "||"
  try {
    let cleanVal = cookieValue.trim().replace(/^["']|["']$/g, "");
    if (cleanVal.toLowerCase().startsWith("steamloginsecure=")) {
      cleanVal = cleanVal.substring(17).trim();
    }
    const decoded = decodeURIComponent(cleanVal);
    const parts = decoded.split(/[|%]+/);
    return parts[0] && /^\d{17}$/.test(parts[0]) ? parts[0] : null;
  } catch {
    return null;
  }
}
