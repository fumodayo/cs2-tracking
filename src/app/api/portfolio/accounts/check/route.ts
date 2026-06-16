import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { USER_AGENTS } from "@/utils/api-client";
import { getPortfolioOwnerId } from "@/services/auth-service";
import { decrypt } from "@/services/crypto-service";
import { ObjectId } from "mongodb";
import { resolveSteamId } from "@/infrastructure/steam";

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


function getOwnerFilter(ownerId: string) {
  if (ownerId === "guest") {
    return {
      $or: [{ ownerId: "guest" }, { ownerId: { $exists: false } }],
    };
  }
  return { ownerId };
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
          { message: "Id tài khoản không hợp lệ." },
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
          { message: "Không tìm thấy tài khoản." },
          { status: 404 },
        );
      }

      if (!account.steamCookie) {
        return NextResponse.json({
          isValid: false,
          message: "Tài khoản chưa cấu hình cookie.",
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
                : "Không tìm thấy profile Steam.",
          });
        }
      }

      if (!targetSteamId64) {
        return NextResponse.json(
          { message: "Thiếu thông tin SteamID64 hoặc Steam URL." },
          { status: 400 },
        );
      }
      if (!steamCookie) {
        return NextResponse.json({
          isValid: false,
          message: "Vui lòng nhập cookie để kiểm tra.",
        });
      }
      decryptedCookie = steamCookie;
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
      const errorMsg = "Cookie steamLoginSecure không đúng định dạng.";
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
      const errorMsg = `Cookie này thuộc về tài khoản Steam khác (${cookieSteamId}), không trùng khớp với tài khoản bạn đang cấu hình (${targetSteamId64}).`;
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
      if (accountId) {
        const db = await getDatabase();
        await db
          .collection("portfolio_accounts")
          .updateOne(
            { _id: new ObjectId(accountId), ...getOwnerFilter(ownerId) },
            { $set: { cookieError: null, updatedAt: new Date() } },
          );
      }
      return NextResponse.json({ isValid: true });
    }

    if (res.status === 401 || res.status === 403) {
      const errorMsg = "Cookie đã hết hạn hoặc không hợp lệ.";
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

    const errorMsg = `Lỗi kết nối Steam (HTTP ${res.status}).`;
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
      error instanceof Error ? error.message : "Đã xảy ra lỗi khi kiểm tra.";
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
