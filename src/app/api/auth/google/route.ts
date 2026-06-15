import { NextResponse } from "next/server";
import { createGoogleAuthorizationUrl } from "@/services/auth-service";
import { getErrorMessage } from "@/utils/error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.redirect(await createGoogleAuthorizationUrl());
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "Không thể bắt đầu đăng nhập Google.") },
      { status: 500 },
    );
  }
}
