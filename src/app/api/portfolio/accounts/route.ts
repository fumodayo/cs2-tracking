import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { getErrorMessage } from "@/utils/error";
import { getPortfolioOwnerId } from "@/services/auth-service";
import { encrypt, decrypt } from "@/services/crypto-service";
import { ObjectId } from "mongodb";
import { resolveSteamId } from "@/infrastructure/steam";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ownerId = await getPortfolioOwnerId();
    const db = await getDatabase();
    const accounts = await db
      .collection("portfolio_accounts")
      .find(getOwnerFilter(ownerId))
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(
      accounts.map((acc) => ({
        id: acc._id.toString(),
        steamId64: acc.steamId64,
        steamUrl: acc.steamUrl,
        name: acc.name,
        avatarUrl: acc.avatarUrl,
        steamCookie: acc.steamCookie ? decrypt(acc.steamCookie) : null,
        cookieError: acc.cookieError || null,
        createdAt: acc.createdAt,
        updatedAt: acc.updatedAt,
      })),
    );
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "Đã xảy ra lỗi.") },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ownerId = await getPortfolioOwnerId();
    const body = await request.json();
    const steamUrl = String(body.steamUrl ?? "").trim();
    const steamCookie = String(body.steamCookie ?? "").trim();

    if (!steamUrl) {
      return NextResponse.json(
        { message: "Vui lòng cung cấp link Steam." },
        { status: 400 },
      );
    }

    // Resolve Steam URL to SteamID64 and fetch profile info
    const resolved = await resolveSteamId(steamUrl);
    const db = await getDatabase();
    const accountsCol = db.collection("portfolio_accounts");

    const now = new Date();
    await accountsCol.updateOne(
      { ownerId, steamId64: resolved.steamId64 },
      {
        $set: {
          ownerId,
          steamId64: resolved.steamId64,
          name: resolved.profile.name,
          avatarUrl: resolved.profile.avatarUrl,
          steamUrl,
          steamCookie: steamCookie ? encrypt(steamCookie) : undefined,
          cookieError: null,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true },
    );

    const saved = await accountsCol.findOne({
      ownerId,
      steamId64: resolved.steamId64,
    });
    return NextResponse.json(
      {
        id: saved?._id.toString(),
        steamId64: saved?.steamId64,
        steamUrl: saved?.steamUrl,
        name: saved?.name,
        avatarUrl: saved?.avatarUrl,
        steamCookie: saved?.steamCookie ? decrypt(saved.steamCookie) : null,
        cookieError: saved?.cookieError || null,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "Đã xảy ra lỗi.") },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ownerId = await getPortfolioOwnerId();
    const body = await request.json();
    const { id, steamCookie } = body;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { message: "Id tài khoản không hợp lệ." },
        { status: 400 },
      );
    }

    const db = await getDatabase();
    const accountsCol = db.collection("portfolio_accounts");

    const updateDoc: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (steamCookie !== undefined) {
      const trimmed = String(steamCookie || "").trim();
      updateDoc.steamCookie = trimmed ? encrypt(trimmed) : "";
      updateDoc.cookieError = null;
    }

    const result = await accountsCol.updateOne(
      { _id: new ObjectId(id), ...getOwnerFilter(ownerId) },
      { $set: updateDoc },
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { message: "Không tìm thấy tài khoản để cập nhật." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "Đã xảy ra lỗi.") },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ownerId = await getPortfolioOwnerId();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { message: "Id tài khoản không hợp lệ." },
        { status: 400 },
      );
    }

    const db = await getDatabase();

    // Find the account first to get its steamId64
    const account = await db.collection("portfolio_accounts").findOne({
      _id: new ObjectId(id),
      ...getOwnerFilter(ownerId),
    });

    if (!account) {
      return NextResponse.json(
        { message: "Không tìm thấy tài khoản để xóa." },
        { status: 404 },
      );
    }

    const steamId64 = account.steamId64;

    // Delete the account
    await db.collection("portfolio_accounts").deleteOne({
      _id: new ObjectId(id),
      ...getOwnerFilter(ownerId),
    });

    // Delete associated portfolio items imported from this account
    await db.collection("portfolio_items").deleteMany({
      ...getOwnerFilter(ownerId),
      note: "Import từ inventory scanner",
      "sourceAccounts.steamId64": steamId64,
    });

    // Delete associated storage units
    await db.collection("storage_units").deleteMany({
      ...getOwnerFilter(ownerId),
      steamId64: steamId64,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "Đã xảy ra lỗi.") },
      { status: 500 },
    );
  }
}

function getOwnerFilter(ownerId: string) {
  if (ownerId === "guest") {
    return {
      $or: [{ ownerId: "guest" }, { ownerId: { $exists: false } }],
    };
  }
  return { ownerId };
}


