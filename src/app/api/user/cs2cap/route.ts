import { NextResponse } from 'next/server';
import {
  getCurrentUser,
  getUserCs2capApiKey,
  getUserCs2capApiKeys,
  addUserCs2capApiKey,
  selectUserCs2capApiKey,
  removeUserCs2capApiKey,
} from '@/services/auth-service';
import { publishUserSettingsChanged } from '@/services/realtime/user-settings-events';

export const dynamic = 'force-dynamic';

// GET /api/user/cs2cap
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
    }

    const customKey = await getUserCs2capApiKey(user.id);
    const keyToUse = customKey || process.env.CS2CAP_API_KEY?.trim() || '';

    const customKeys = await getUserCs2capApiKeys(user.id);
    const keys = customKeys.map((k) => ({
      prefix: k.slice(0, 12) + '•'.repeat(24),
      isActive: k === customKey,
    }));

    if (!keyToUse) {
      return NextResponse.json({
        hasCustomKey: false,
        keyPrefix: null,
        keys: [],
        account: null,
        message: 'noApiKeyConfigured',
      });
    }

    // Lấy thống kê tài khoản từ CS2Cap
    const res = await fetch('https://api.cs2c.app/v1/account', {
      headers: {
        Authorization: `Bearer ${keyToUse}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json({
        hasCustomKey: !!customKey,
        keyPrefix: customKey ? customKey.slice(0, 12) + '•'.repeat(24) : null,
        keys,
        account: null,
        error: 'failedToGetAccountInfo',
      });
    }

    const accountData = await res.json();
    const keyPrefix = customKey ? customKey.slice(0, 12) + '•'.repeat(24) : null;

    return NextResponse.json({
      hasCustomKey: !!customKey,
      keyPrefix,
      keys,
      account: accountData,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ message: 'internalServerError', details: msg }, { status: 500 });
  }
}

// POST /api/user/cs2cap
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const action = typeof body.action === 'string' ? body.action.trim() : '';

    if (action === 'select') {
      const keyPrefix = typeof body.keyPrefix === 'string' ? body.keyPrefix.trim() : '';
      if (!keyPrefix) {
        return NextResponse.json({ message: 'missingKeyPrefix' }, { status: 400 });
      }

      const customKeys = await getUserCs2capApiKeys(user.id);
      const match = customKeys.find((k) => k.slice(0, 12) + '•'.repeat(24) === keyPrefix);
      if (!match) {
        return NextResponse.json({ message: 'apiKeyNotFound' }, { status: 404 });
      }

      await selectUserCs2capApiKey(user.id, match);
      await publishUserSettingsChanged(`google:${user.id}`, 'cs2cap_key_selected', {
        keyPrefix,
      });

      // Lấy thống kê tài khoản active mới
      const res = await fetch('https://api.cs2c.app/v1/account', {
        headers: {
          Authorization: `Bearer ${match}`,
          'Content-Type': 'application/json',
        },
      });

      let accountData = null;
      if (res.ok) {
        accountData = await res.json();
      }

      const updatedKeys = customKeys.map((k) => ({
        prefix: k.slice(0, 12) + '•'.repeat(24),
        isActive: k === match,
      }));

      return NextResponse.json({
        message: 'switchedKeySuccess',
        hasCustomKey: true,
        keyPrefix,
        keys: updatedKeys,
        account: accountData,
      });
    }

    if (action === 'delete') {
      const keyPrefix = typeof body.keyPrefix === 'string' ? body.keyPrefix.trim() : '';
      if (!keyPrefix) {
        return NextResponse.json({ message: 'missingKeyPrefix' }, { status: 400 });
      }

      const customKeys = await getUserCs2capApiKeys(user.id);
      const match = customKeys.find((k) => k.slice(0, 12) + '•'.repeat(24) === keyPrefix);
      if (!match) {
        return NextResponse.json({ message: 'apiKeyNotFound' }, { status: 404 });
      }

      await removeUserCs2capApiKey(user.id, match);
      await publishUserSettingsChanged(`google:${user.id}`, 'cs2cap_key_deleted', {
        keyPrefix,
      });

      // Lấy thống kê active mới
      const newActiveKey = await getUserCs2capApiKey(user.id);
      const remainingKeys = customKeys.filter((k) => k !== match);
      const keysList = remainingKeys.map((k) => ({
        prefix: k.slice(0, 12) + '•'.repeat(24),
        isActive: k === newActiveKey,
      }));

      let accountData = null;
      const keyToUse = newActiveKey || process.env.CS2CAP_API_KEY?.trim() || '';
      if (keyToUse) {
        const res = await fetch('https://api.cs2c.app/v1/account', {
          headers: {
            Authorization: `Bearer ${keyToUse}`,
            'Content-Type': 'application/json',
          },
        });
        if (res.ok) {
          accountData = await res.json();
        }
      }

      return NextResponse.json({
        message: 'deleteKeySuccess',
        hasCustomKey: !!newActiveKey,
        keyPrefix: newActiveKey ? newActiveKey.slice(0, 12) + '•'.repeat(24) : null,
        keys: keysList,
        account: accountData,
      });
    }

    // Mặc định: thêm key mới
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : null;

    if (!apiKey) {
      return NextResponse.json({ message: 'missingApiKey' }, { status: 400 });
    }

    // Validate key với CS2Cap trước
    const res = await fetch('https://api.cs2c.app/v1/account', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ message: 'invalidCs2capApiKey' }, { status: 400 });
    }

    const accountData = await res.json();

    // Lưu danh sách key
    await addUserCs2capApiKey(user.id, apiKey);

    const keyPrefix = apiKey.slice(0, 12) + '•'.repeat(24);
    await publishUserSettingsChanged(`google:${user.id}`, 'cs2cap_key_added', {
      keyPrefix,
    });
    const customKeys = await getUserCs2capApiKeys(user.id);
    const keysList = customKeys.map((k) => ({
      prefix: k.slice(0, 12) + '•'.repeat(24),
      isActive: k === apiKey,
    }));

    return NextResponse.json({
      message: 'configureSuccess',
      hasCustomKey: true,
      keyPrefix,
      keys: keysList,
      account: accountData,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ message: 'internalServerError', details: msg }, { status: 500 });
  }
}
