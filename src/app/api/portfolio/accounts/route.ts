import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/infrastructure/db/mongo-client';
import { getErrorMessage } from '@/utils/error';
import { getPortfolioOwnerId } from '@/services/auth-service';
import { encrypt, decrypt } from '@/services/crypto-service';
import { ObjectId } from 'mongodb';
import { resolveSteamId } from '@/infrastructure/steam';
import { getCookiePreview, mergeIncomingCookieWithExisting } from '@/utils/steam-cookies';
import { getOwnerFilter } from '@/infrastructure/db/owner-filter';
import { steamAccountSchema } from '@/utils/validation';
import { SCANNER_IMPORT_NOTES } from '@/services/portfolio-sync';
import { publishPortfolioChanged } from '@/services/realtime/portfolio-events';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ownerId = await getPortfolioOwnerId();
    const db = await getDatabase();
    const accounts = await db
      .collection('portfolio_accounts')
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
        steamCookie: acc.steamCookie ? getCookiePreview(decrypt(acc.steamCookie)) : null,
        cookieError: acc.cookieError || null,
        walletBalance: acc.walletBalance || null,
        walletBalanceVnd: acc.walletBalanceVnd || null,
        createdAt: acc.createdAt,
        updatedAt: acc.updatedAt,
      }))
    );
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error, 'unknownError') }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ownerId = await getPortfolioOwnerId();
    const body = await request.json();
    const parsed = steamAccountSchema.pick({ steamUrl: true, steamCookie: true }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });
    }
    const { steamUrl, steamCookie } = parsed.data;

    // Resolve Steam URL thành SteamID64 và lấy thông tin hồ sơ
    const resolved = await resolveSteamId(steamUrl);
    const db = await getDatabase();
    const accountsCol = db.collection('portfolio_accounts');

    const existingAccount = await accountsCol.findOne({ ownerId, steamId64: resolved.steamId64 });
    let finalCookie = steamCookie;
    if (existingAccount?.steamCookie && steamCookie) {
      const decryptedExisting = decrypt(existingAccount.steamCookie);
      finalCookie = mergeIncomingCookieWithExisting(steamCookie, decryptedExisting);
    }

    const now = new Date();
    const setFields: Record<string, unknown> = {
      ownerId,
      steamId64: resolved.steamId64,
      name: resolved.profile.name,
      avatarUrl: resolved.profile.avatarUrl,
      steamUrl,
      cookieError: null,
      updatedAt: now,
    };

    if (finalCookie) {
      setFields.steamCookie = encrypt(finalCookie);
    }

    await accountsCol.updateOne(
      { ownerId, steamId64: resolved.steamId64 },
      {
        $set: setFields,
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
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
        steamCookie: saved?.steamCookie ? getCookiePreview(decrypt(saved.steamCookie)) : null,
        cookieError: saved?.cookieError || null,
        walletBalance: saved?.walletBalance || null,
        walletBalanceVnd: saved?.walletBalanceVnd || null,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error, 'unknownError') }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ownerId = await getPortfolioOwnerId();
    const body = await request.json();
    const { id, steamCookie } = body;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'invalidAccountId' }, { status: 400 });
    }

    const db = await getDatabase();
    const accountsCol = db.collection('portfolio_accounts');

    const updateDoc: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (steamCookie !== undefined) {
      const trimmed = String(steamCookie || '').trim();
      let finalCookie = trimmed;
      if (trimmed) {
        const existingAccount = await accountsCol.findOne({
          _id: new ObjectId(id),
          ...getOwnerFilter(ownerId),
        });
        if (existingAccount?.steamCookie) {
          const decryptedExisting = decrypt(existingAccount.steamCookie);
          finalCookie = mergeIncomingCookieWithExisting(trimmed, decryptedExisting);
        }
      }
      updateDoc.steamCookie = finalCookie ? encrypt(finalCookie) : '';
      updateDoc.cookieError = null;
    }

    const result = await accountsCol.updateOne(
      { _id: new ObjectId(id), ...getOwnerFilter(ownerId) },
      { $set: updateDoc }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: 'accountNotFoundToUpdate' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error, 'unknownError') }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ownerId = await getPortfolioOwnerId();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'invalidAccountId' }, { status: 400 });
    }

    const db = await getDatabase();

    // Tìm tài khoản trước để lấy steamId64
    const account = await db.collection('portfolio_accounts').findOne({
      _id: new ObjectId(id),
      ...getOwnerFilter(ownerId),
    });

    if (!account) {
      return NextResponse.json({ message: 'accountNotFoundToDelete' }, { status: 404 });
    }

    const steamId64 = account.steamId64;

    // Xóa tài khoản
    await db.collection('portfolio_accounts').deleteOne({
      _id: new ObjectId(id),
      ...getOwnerFilter(ownerId),
    });

    // Xóa các vật phẩm portfolio được import từ tài khoản này
    const portfolioDeleteResult = await db.collection('portfolio_items').deleteMany({
      ...getOwnerFilter(ownerId),
      note: { $in: [...SCANNER_IMPORT_NOTES] },
      'sourceAccounts.steamId64': steamId64,
    });

    // Xóa các storage unit liên quan
    await db.collection('storage_units').deleteMany({
      ...getOwnerFilter(ownerId),
      steamId64: steamId64,
    });

    await publishPortfolioChanged(ownerId, 'deleted_many', {
      count: portfolioDeleteResult.deletedCount,
      steamId64,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error, 'unknownError') }, { status: 500 });
  }
}
