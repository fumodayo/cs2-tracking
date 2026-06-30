import { NextResponse } from "next/server";
import { createGoogleAuthorizationUrl } from "@/services/auth-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.redirect(await createGoogleAuthorizationUrl());
  } catch {
    return NextResponse.json(
      { message: "googleAuthInitFailed" },
      { status: 500 },
    );
  }
}
