import { getDatabase } from '@/infrastructure/db/mongo-client';
import { fetchSteamWalletBalance } from '@/infrastructure/steam';

export type ScanWalletBalance = {
  walletRaw: string | null;
  walletVnd: number | null;
};

export async function fetchScanWalletBalance({
  hasCookie,
  cookieHeader,
}: {
  hasCookie: boolean;
  cookieHeader?: string;
}): Promise<ScanWalletBalance> {
  if (!hasCookie || !cookieHeader) {
    return { walletRaw: null, walletVnd: null };
  }

  // Tra cứu ví là metadata quét tùy chọn; trả về status có kiểu thay vì làm fail toàn bộ lượt quét.
  try {
    const walletResult = await fetchSteamWalletBalance(cookieHeader);
    if (walletResult) {
      return {
        walletRaw: walletResult.raw,
        walletVnd: walletResult.vnd,
      };
    }
    return { walletRaw: 'walletBalanceNotFound', walletVnd: null };
  } catch (walletErr) {
    console.error('Failed to fetch steam wallet balance:', walletErr);
    return {
      walletRaw: `walletBalanceError:message=${
        walletErr instanceof Error ? walletErr.message : String(walletErr)
      }`,
      walletVnd: null,
    };
  }
}

export async function persistSuccessfulScanAccountState({
  hasCookie,
  ownerId,
  steamId64,
  walletRaw,
  walletVnd,
}: {
  hasCookie: boolean;
  ownerId?: string;
  steamId64: string;
  walletRaw: string | null;
  walletVnd: number | null;
}) {
  if (!hasCookie || !ownerId || ownerId === 'guest') return;

  try {
    const db = await getDatabase();
    // Lượt quét private thành công chứng minh cookie đang lưu dùng được, nên xóa lỗi cookie gần nhất.
    const updateDoc: Record<string, unknown> = { cookieError: null };
    if (walletRaw !== null) {
      updateDoc.walletBalance = walletRaw;
      updateDoc.walletBalanceVnd = walletVnd;
    }
    await db
      .collection('portfolio_accounts')
      .updateOne({ steamId64, ownerId }, { $set: updateDoc });
  } catch {
    /* ignore */
  }
}

export async function persistScanAccountCookieError({
  ownerId,
  steamId64,
  error,
}: {
  ownerId?: string;
  steamId64?: string;
  error: unknown;
}) {
  if (!ownerId || !steamId64 || ownerId === 'guest' || !isScanCookieError(error)) return;

  try {
    const db = await getDatabase();
    await db.collection('portfolio_accounts').updateOne(
      { steamId64, ownerId },
      {
        $set: {
          cookieError: error instanceof Error ? error.message : String(error),
        },
      }
    );
  } catch {
    /* ignore */
  }
}

function isScanCookieError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('Cookie') ||
      error.message.includes('cookie') ||
      error.message.includes('privateInventory') ||
      error.message.includes('Family View') ||
      error.message.includes('familyView'))
  );
}
