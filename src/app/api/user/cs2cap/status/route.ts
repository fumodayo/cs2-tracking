import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/user/cs2cap/status
// Endpoint public: trả về việc server có cấu hình CS2Cap API key mặc định hay không,
// kèm thông tin usage/tier từ CS2Cap để hiển thị cho khách.
export async function GET() {
  const apiKey = process.env.CS2CAP_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ hasDefaultKey: false, account: null });
  }

  try {
    const res = await fetch('https://api.cs2c.app/v1/account', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 60 }, // cache 60s to avoid too many calls
    });

    if (!res.ok) {
      return NextResponse.json({ hasDefaultKey: true, account: null });
    }

    const account = await res.json();
    return NextResponse.json({ hasDefaultKey: true, account });
  } catch {
    return NextResponse.json({ hasDefaultKey: true, account: null });
  }
}
