import type { PortfolioSourceAccount } from '@/domain/portfolio-item';
import { getDatabase } from '@/infrastructure/db/mongo-client';
import { encrypt, decrypt } from '@/services/crypto-service';
import { getCachedScan } from '@/services/scan-cache';
import { mergeIncomingCookieWithExisting } from '@/utils/steam-cookies';
import type { ScannedImportInput, SendImportProgress } from './import-inventory-types';

type ManualImportInput = {
  sourceAccounts?: PortfolioSourceAccount[];
};

type SaveImportedPortfolioAccountsParams = {
  ownerId: string;
  scannedInputs: Iterable<ScannedImportInput>;
  manualInputs: ManualImportInput[];
  bodyAccounts: unknown;
  sendProgress: SendImportProgress;
};

// Liên kết tài khoản là tác vụ phụ best-effort khi import vật phẩm; import vật phẩm không được fail
// chỉ vì metadata tài khoản, avatar, trạng thái cache hoặc lưu cookie gặp vấn đề.
export async function saveImportedPortfolioAccounts({
  ownerId,
  scannedInputs,
  manualInputs,
  bodyAccounts,
  sendProgress,
}: SaveImportedPortfolioAccountsParams) {
  try {
    const allUniqueAccounts = collectUniqueSourceAccounts(scannedInputs, manualInputs);
    if (allUniqueAccounts.size === 0) {
      return;
    }

    const db = await getDatabase();
    const accountsCollection = db.collection('portfolio_accounts');
    const now = new Date();
    const cookieMap = getClientCookieMap(bodyAccounts);

    let accIdx = 0;
    for (const account of allUniqueAccounts.values()) {
      // Ưu tiên cache private cho trường ví/cookie, rồi dự phòng bằng cache public cho dữ liệu hồ sơ.
      const privateCacheDoc = await getCachedScan({
        steamId64: account.steamId64,
        ownerId,
        hasCookie: true,
      });
      const publicCacheDoc = await getCachedScan({
        steamId64: account.steamId64,
        hasCookie: false,
      });
      const cacheDoc = privateCacheDoc ?? publicCacheDoc;
      const avatarUrl = cacheDoc?.profile?.avatarUrl || null;
      const clientCookie = cookieMap.get(account.steamId64);

      const $setFields: Record<string, unknown> = {
        ownerId,
        steamId64: account.steamId64,
        name: account.name,
        avatarUrl,
        updatedAt: now,
      };

      if (clientCookie) {
        // Client có thể gửi cookie một phần mới hơn, nên gộp với cookie đã mã hóa đang lưu.
        let finalCookie = clientCookie;
        const existingAcc = await accountsCollection.findOne({
          ownerId,
          steamId64: account.steamId64,
        });
        if (existingAcc?.steamCookie) {
          const decryptedExisting = decrypt(existingAcc.steamCookie);
          finalCookie = mergeIncomingCookieWithExisting(clientCookie, decryptedExisting);
        }
        $setFields.steamCookie = encrypt(finalCookie);
      }

      if (privateCacheDoc) {
        if (privateCacheDoc.walletBalance !== undefined) {
          $setFields.walletBalance = privateCacheDoc.walletBalance;
        }
        if (privateCacheDoc.walletBalanceVnd !== undefined) {
          $setFields.walletBalanceVnd = privateCacheDoc.walletBalanceVnd;
        }
        if (privateCacheDoc.cookieError !== undefined) {
          $setFields.cookieError = privateCacheDoc.cookieError;
        }
      }

      await accountsCollection.updateOne(
        { ownerId, steamId64: account.steamId64 },
        {
          $set: $setFields,
          $setOnInsert: {
            steamUrl: `https://steamcommunity.com/profiles/${account.steamId64}`,
            createdAt: now,
          },
        },
        { upsert: true }
      );
      accIdx++;
      sendProgress({
        type: 'progress',
        message: `importProgressLinkingAccount:current=${accIdx},total=${allUniqueAccounts.size},name=${account.name}`,
        percent: 85 + Math.round((accIdx / allUniqueAccounts.size) * 10),
        step: 'accounts',
      });
    }
  } catch (saveAccountsError) {
    console.error('Failed to automatically save portfolio accounts:', saveAccountsError);
  }
}

function collectUniqueSourceAccounts(
  scannedInputs: Iterable<ScannedImportInput>,
  manualInputs: ManualImportInput[]
) {
  const allUniqueAccounts = new Map<string, PortfolioSourceAccount>();

  // Khử trùng lặp theo SteamID giữa vật phẩm quét và nhập tay trước khi upsert tài khoản.
  for (const input of scannedInputs) {
    for (const account of input.sourceAccounts) {
      allUniqueAccounts.set(account.steamId64, account);
    }
  }
  for (const input of manualInputs) {
    if (input.sourceAccounts) {
      for (const account of input.sourceAccounts) {
        allUniqueAccounts.set(account.steamId64, account);
      }
    }
  }

  return allUniqueAccounts;
}

function getClientCookieMap(bodyAccounts: unknown) {
  const cookieMap = new Map<string, string>();
  if (!Array.isArray(bodyAccounts)) {
    return cookieMap;
  }

  for (const account of bodyAccounts) {
    if (
      account &&
      typeof account === 'object' &&
      typeof (account as { steamId64?: unknown }).steamId64 === 'string' &&
      typeof (account as { steamCookie?: unknown }).steamCookie === 'string'
    ) {
      const steamId64 = (account as { steamId64: string }).steamId64;
      const trimmed = (account as { steamCookie: string }).steamCookie.trim();
      if (trimmed) {
        cookieMap.set(steamId64, trimmed);
      }
    }
  }

  return cookieMap;
}
