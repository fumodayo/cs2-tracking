import { NextRequest, NextResponse } from "next/server";
import { handleGoogleCallback } from "@/services/auth-service";
import { getErrorMessage } from "@/utils/error";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return redirectWithError(request, `Google từ chối đăng nhập: ${error}`);
  }

  if (!code || !state) {
    return redirectWithError(request, "Thiếu mã xác thực Google.");
  }

  try {
    await handleGoogleCallback(code, state);
    return NextResponse.redirect(
      new URL("/portfolio?login=google", request.url),
    );
  } catch (callbackError) {
    return redirectWithError(
      request,
      getErrorMessage(callbackError, "Không thể hoàn tất đăng nhập Google."),
    );
  }
}

function redirectWithError(request: NextRequest, message: string) {
  const url = new URL("/portfolio", request.url);
  url.searchParams.set("authError", message);
  return NextResponse.redirect(url);
}
