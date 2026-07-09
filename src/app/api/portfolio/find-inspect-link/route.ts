import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/infrastructure/db/mongo-client';
import { getPortfolioOwnerId } from '@/services/auth-service';
import { getOwnerFilter } from '@/infrastructure/db/owner-filter';
import { getErrorMessage } from '@/utils/error';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const ownerId = await getPortfolioOwnerId();
    const url = new URL(request.url);
    const marketHashName = url.searchParams.get('marketHashName') || '';

    if (!marketHashName) {
      return NextResponse.json({ inspectLink: null });
    }

    const db = await getDatabase();

    // Tìm toàn bộ tài khoản Steam của user này
    const accounts = await db
      .collection('portfolio_accounts')
      .find(getOwnerFilter(ownerId))
      .toArray();

    const steamIds = accounts.map((acc) => acc.steamId64).filter(Boolean);
    if (steamIds.length === 0) {
      return NextResponse.json({ inspectLink: null });
    }

    // Tìm cache của các tài khoản này
    const cacheCol = db.collection('inventory_scan_cache');
    const cacheDocs = await cacheCol
      .find({
        steamId64: { $in: steamIds },
        $or: [{ ownerId }, { hasCookie: false }],
      })
      .toArray();

    // Duyệt các document cache và tìm vật phẩm khớp đầu tiên có inspectLink
    for (const doc of cacheDocs) {
      if (Array.isArray(doc.items)) {
        // Thử khớp chính xác marketHashName
        const match = doc.items.find((item: Record<string, unknown>) => {
          const caseItem =
            item.caseItem && typeof item.caseItem === 'object'
              ? (item.caseItem as Record<string, unknown>)
              : null;
          const itemMarketHashName =
            typeof item.marketHashName === 'string'
              ? item.marketHashName
              : typeof caseItem?.marketHashName === 'string'
                ? caseItem.marketHashName
                : '';

          return (
            itemMarketHashName === marketHashName &&
            typeof item.inspectLink === 'string' &&
            item.inspectLink.trim().length > 0
          );
        });
        if (match) {
          return NextResponse.json({ inspectLink: match.inspectLink });
        }
      }
    }

    return NextResponse.json({ inspectLink: null });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error, 'unknownError') }, { status: 500 });
  }
}
