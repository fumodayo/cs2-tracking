import { NextResponse } from "next/server";
import { createGoogleAuthorizationUrl } from "@/services/auth-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.redirect(await createGoogleAuthorizationUrl());
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Không thể bắt đầu đăng nhập Google.";
}
