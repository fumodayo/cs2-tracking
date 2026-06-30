import { NextRequest, NextResponse } from "next/server";
import { cs2capValidationRateLimiter } from "@/infrastructure/rate-limiter";
import { cs2capValidateSchema } from "@/utils/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || (request as NextRequest & { ip?: string }).ip || "unknown-ip";
    const { allowed, retryAfter } = await cs2capValidationRateLimiter.check(ip);
    if (!allowed) {
      return NextResponse.json(
        { message: "tooManyRequests", retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const body = await request.json();
    const parsed = cs2capValidateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });
    }
    const { apiKey } = parsed.data;

    const res = await fetch("https://api.cs2c.app/v1/account", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { message: "invalidCs2capApiKey" },
        { status: 400 },
      );
    }

    const accountData = await res.json();
    return NextResponse.json({
      valid: true,
      account: accountData,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { message: "internalServerError", details: msg },
      { status: 500 },
    );
  }
}
