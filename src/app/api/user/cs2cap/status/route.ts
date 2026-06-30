import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/user/cs2cap/status
// Public endpoint: returns whether the server has a default CS2Cap API key configured,
// plus account usage/tier info from CS2Cap for guests to display.
export async function GET() {
  const apiKey = process.env.CS2CAP_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ hasDefaultKey: false, account: null });
  }

  try {
    const res = await fetch("https://api.cs2c.app/v1/account", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
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
