import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/infrastructure/db/mongo-client';
import { getCurrentUser } from '@/services/auth-service';
import { getErrorMessage } from '@/utils/error';
import { normalizeBuffPricesCny, type BuffPricesCny } from '@/utils/buff-prices';

const COLLECTION = 'user_buff_prices';
const MAX_BUFF_PRICE_ITEMS = 2000;
const MAX_MARKET_HASH_NAME_LENGTH = 512;

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ownerId = await requireOwnerId();
    const pricesCny = await readUserBuffPrices(ownerId);
    return NextResponse.json({ pricesCny });
  } catch (error) {
    return handleBuffPriceError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ownerId = await requireOwnerId();
    const body = await request.json();
    const pricesCny = parsePricesMap(body?.pricesCny);

    if (Object.keys(pricesCny).length > 0) {
      await upsertUserBuffPrices(ownerId, pricesCny);
    }

    return NextResponse.json({ pricesCny: await readUserBuffPrices(ownerId) });
  } catch (error) {
    return handleBuffPriceError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ownerId = await requireOwnerId();
    const body = await request.json();
    const pricesCny = parsePricesMap(body?.pricesCny);
    await replaceUserBuffPrices(ownerId, pricesCny);
    return NextResponse.json({ pricesCny: await readUserBuffPrices(ownerId) });
  } catch (error) {
    return handleBuffPriceError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ownerId = await requireOwnerId();
    const body = await request.json();
    const marketHashName =
      typeof body?.marketHashName === 'string' ? body.marketHashName.trim() : '';

    if (!isValidMarketHashName(marketHashName)) {
      return NextResponse.json({ message: 'invalidMarketHashName' }, { status: 400 });
    }

    const rawPrice = body?.priceCny;
    const priceCny = rawPrice === null ? null : Number(rawPrice);
    const db = await getDatabase();
    const collection = db.collection(COLLECTION);

    if (priceCny === null || !Number.isFinite(priceCny) || priceCny <= 0) {
      await collection.deleteOne({ ownerId, marketHashName });
    } else {
      const now = new Date();
      await collection.updateOne(
        { ownerId, marketHashName },
        {
          $set: { ownerId, marketHashName, priceCny, updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );
    }

    return NextResponse.json({ pricesCny: await readUserBuffPrices(ownerId) });
  } catch (error) {
    return handleBuffPriceError(error);
  }
}

async function requireOwnerId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) {
    throw new BuffPriceApiError('unauthorized', 401);
  }
  return `google:${user.id}`;
}

function parsePricesMap(value: unknown): BuffPricesCny {
  const pricesCny = normalizeBuffPricesCny(value);
  const entries = Object.entries(pricesCny).filter(([marketHashName]) =>
    isValidMarketHashName(marketHashName)
  );

  if (entries.length > MAX_BUFF_PRICE_ITEMS) {
    throw new BuffPriceApiError('tooManyBuffPrices', 400);
  }

  return Object.fromEntries(entries);
}

function isValidMarketHashName(marketHashName: string): boolean {
  return marketHashName.length > 0 && marketHashName.length <= MAX_MARKET_HASH_NAME_LENGTH;
}

async function readUserBuffPrices(ownerId: string): Promise<BuffPricesCny> {
  const db = await getDatabase();
  const docs = await db
    .collection(COLLECTION)
    .find({ ownerId })
    .project({ marketHashName: 1, priceCny: 1 })
    .sort({ marketHashName: 1 })
    .toArray();

  const pricesCny: BuffPricesCny = {};
  for (const doc of docs) {
    const marketHashName = typeof doc.marketHashName === 'string' ? doc.marketHashName : '';
    const priceCny = Number(doc.priceCny);
    if (isValidMarketHashName(marketHashName) && Number.isFinite(priceCny) && priceCny > 0) {
      pricesCny[marketHashName] = priceCny;
    }
  }

  return pricesCny;
}

async function upsertUserBuffPrices(ownerId: string, pricesCny: BuffPricesCny): Promise<void> {
  const entries = Object.entries(pricesCny);
  if (entries.length === 0) return;

  const now = new Date();
  const db = await getDatabase();
  await db.collection(COLLECTION).bulkWrite(
    entries.map(([marketHashName, priceCny]) => ({
      updateOne: {
        filter: { ownerId, marketHashName },
        update: {
          $set: { ownerId, marketHashName, priceCny, updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  );
}

async function replaceUserBuffPrices(ownerId: string, pricesCny: BuffPricesCny): Promise<void> {
  const db = await getDatabase();
  const collection = db.collection(COLLECTION);
  const names = Object.keys(pricesCny);

  if (names.length === 0) {
    await collection.deleteMany({ ownerId });
    return;
  }

  await upsertUserBuffPrices(ownerId, pricesCny);
  await collection.deleteMany({
    ownerId,
    marketHashName: { $nin: names },
  });
}

function handleBuffPriceError(error: unknown) {
  if (error instanceof BuffPriceApiError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { message: getErrorMessage(error, 'cannotSyncBuffPrices') },
    { status: 500 }
  );
}

class BuffPriceApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}
