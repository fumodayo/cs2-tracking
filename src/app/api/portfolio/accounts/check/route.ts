import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { USER_AGENTS } from "@/utils/api-client";
import { getPortfolioOwnerId } from "@/services/auth-service";
import { decrypt } from "@/services/crypto-service";
import { ObjectId } from "mongodb";
import { resolveSteamId, fetchSteamWalletBalance } from "@/infrastructure/steam";
import { parseSteamCookies, buildSteamCookie, mergeIncomingCookieWithExisting } from "@/utils/steam-cookies";
import { getOwnerFilter } from "@/infrastructure/db/owner-filter";

export const dynamic = "force-dynamic";

function parseSteamLoginSecure(rawCookie: string): string {
  const trimmed = rawCookie.trim();

  if (trimmed.includes(";")) {
    for (const pair of trimmed.split(";")) {
      const [key, ...rest] = pair.trim().split("=");
      if (key?.trim().toLowerCase() === "steamloginsecure") {
        return rest.join("=").trim();
      }
    }
  }

  if (trimmed.toLowerCase().startsWith("steamloginsecure=")) {
    return trimmed.substring("steamloginsecure=".length).trim();
  }

  return trimmed;
}


export async function POST(request: NextRequest) {
  let accountId: string | undefined;
  let ownerId: string | undefined;
  try {
    ownerId = await getPortfolioOwnerId();
    const body = await request.json();
    accountId = body.accountId;
    const { steamId64, steamCookie, steamUrl } = body;

    let targetSteamId64 = steamId64;
    let decryptedCookie = "";

    if (accountId) {
      if (!ObjectId.isValid(accountId)) {
        return NextResponse.json(
          { message: "invalidAccountId" },
          { status: 400 },
        );
      }

      const db = await getDatabase();
      const account = await db.collection("portfolio_accounts").findOne({
        _id: new ObjectId(accountId),
        ...getOwnerFilter(ownerId),
      });

      if (!account) {
        return NextResponse.json(
          { message: "accountNotFound" },
          { status: 404 },
        );
      }

      if (!account.steamCookie) {
        return NextResponse.json({
          isValid: false,
          message: "accountCookieNotConfigured",
        });
      }

      targetSteamId64 = account.steamId64;
      decryptedCookie = decrypt(account.steamCookie);
    } else {
      if (!targetSteamId64 && steamUrl) {
        try {
          const resolved = await resolveSteamId(steamUrl);
          targetSteamId64 = resolved.steamId64;
        } catch (resolveErr) {
          return NextResponse.json({
            isValid: false,
            message:
              resolveErr instanceof Error
                ? resolveErr.message
                : "steamProfileNotFound",
          });
        }
      }

      if (!targetSteamId64) {
        return NextResponse.json(
          { message: "missingSteamIdOrUrl" },
          { status: 400 },
        );
      }
      if (!steamCookie) {
        return NextResponse.json({
          isValid: false,
          message: "enterCookieToCheck",
        });
      }
      let finalCookie = steamCookie;
      if (targetSteamId64) {
        try {
          const db = await getDatabase();
          const existingAccount = await db.collection("portfolio_accounts").findOne({
            ownerId,
            steamId64: targetSteamId64,
          });
          if (existingAccount?.steamCookie) {
            const decryptedExisting = decrypt(existingAccount.steamCookie);
            finalCookie = mergeIncomingCookieWithExisting(steamCookie, decryptedExisting);
          }
        } catch (dbErr) {
          console.error("[check/route.ts] Failed to fetch and merge existing account cookie:", dbErr);
        }
      }
      decryptedCookie = finalCookie;
    }

    const cookieValue = parseSteamLoginSecure(decryptedCookie);

    // Parse SteamID and access token from cookie
    const decoded = decodeURIComponent(cookieValue);
    let cookieSteamId: string | null = null;
    try {
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
            cookieSteamId = payload.sub;
          }
        }
      }
    } catch {
      /* ignore */
    }

    const parts = decoded.split(/[|%]+/);
    if (!cookieSteamId) {
      cookieSteamId = parts[0] && /^\d{17}$/.test(parts[0]) ? parts[0] : null;
    }
    const accessToken = parts.length >= 2 && parts[1] ? parts[1] : null;

    if (!cookieSteamId || !accessToken) {
      const errorMsg = "invalidCookieFormat";
      if (accountId) {
        const db = await getDatabase();
        await db
          .collection("portfolio_accounts")
          .updateOne(
            { _id: new ObjectId(accountId), ...getOwnerFilter(ownerId) },
            { $set: { cookieError: errorMsg, updatedAt: new Date() } },
          );
      }
      return NextResponse.json({ isValid: false, message: errorMsg });
    }

    if (cookieSteamId !== targetSteamId64) {
      const errorMsg = `cookieSteamIdMismatch:cookieSteamId=${cookieSteamId},steamId64=${targetSteamId64}`;
      if (accountId) {
        const db = await getDatabase();
        await db
          .collection("portfolio_accounts")
          .updateOne(
            { _id: new ObjectId(accountId), ...getOwnerFilter(ownerId) },
            { $set: { cookieError: errorMsg, updatedAt: new Date() } },
          );
      }
      return NextResponse.json({
        isValid: false,
        message: errorMsg,
      });
    }

    const params = new URLSearchParams({
      access_token: accessToken,
      max_trades: "1",
      get_descriptions: "0",
      language: "english",
      include_total: "0",
      start_after_time: "0",
      start_after_tradeid: "0",
      navigating_back: "false",
      include_failed: "false",
    });

    const res = await fetch(
      `https://api.steampowered.com/IEconService/GetTradeHistory/v1/?${params}`,
      {
        headers: { "User-Agent": USER_AGENTS.steamApi },
        cache: "no-store",
      },
    );

    if (res.ok) {
      let walletRaw: string | null = null;
      let walletVnd: number | null = null;
      try {
        const parsed = parseSteamCookies(decryptedCookie);
        const standardCookie = buildSteamCookie(
          parsed.steamLoginSecure,
          parsed.sessionid,
          parsed.steamparental
        );
        const walletResult = await fetchSteamWalletBalance(standardCookie);
        if (walletResult) {
          walletRaw = walletResult.raw;
          walletVnd = walletResult.vnd;
        }
      } catch (walletErr) {
        console.error("Failed to fetch steam wallet balance on check:", walletErr);
      }

      if (accountId) {
        const db = await getDatabase();
        const updateDoc: Record<string, unknown> = {
          cookieError: null,
          updatedAt: new Date()
        };
        if (walletRaw !== null) {
          updateDoc.walletBalance = walletRaw;
          updateDoc.walletBalanceVnd = walletVnd;
        }
        await db
          .collection("portfolio_accounts")
          .updateOne(
            { _id: new ObjectId(accountId), ...getOwnerFilter(ownerId) },
            { $set: updateDoc },
          );
      }
      return NextResponse.json({ isValid: true });
    }

    if (res.status === 401 || res.status === 403) {
      const errorMsg = "cookieExpiredOrInvalid";
      if (accountId) {
        const db = await getDatabase();
        await db
          .collection("portfolio_accounts")
          .updateOne(
            { _id: new ObjectId(accountId), ...getOwnerFilter(ownerId) },
            { $set: { cookieError: errorMsg, updatedAt: new Date() } },
          );
      }
      return NextResponse.json({
        isValid: false,
        isExpired: true,
        message: errorMsg,
      });
    }

    const errorMsg = `steamConnectionError:status=${res.status}`;
    if (accountId) {
      const db = await getDatabase();
      await db
        .collection("portfolio_accounts")
        .updateOne(
          { _id: new ObjectId(accountId), ...getOwnerFilter(ownerId) },
          { $set: { cookieError: errorMsg, updatedAt: new Date() } },
        );
    }
    return NextResponse.json({ isValid: false, message: errorMsg });
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "checkErrorGeneric";
    if (accountId) {
      try {
        const db = await getDatabase();
        const filter: Record<string, unknown> = { _id: new ObjectId(accountId) };
        if (ownerId) {
          Object.assign(filter, getOwnerFilter(ownerId));
        }
        await db
          .collection("portfolio_accounts")
          .updateOne(filter, {
            $set: { cookieError: errorMsg, updatedAt: new Date() },
          });
      } catch {
        /* ignore */
      }
    }
    return NextResponse.json({ message: errorMsg }, { status: 500 });
  }
}
