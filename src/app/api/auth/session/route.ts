import { NextResponse } from "next/server";
import {
  getCurrentUser,
  isGoogleAuthConfigured,
  isAdminAccessAllowed,
} from "@/services/auth-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const isAdmin = isAdminAccessAllowed(user);
  return NextResponse.json({
    user,
    googleConfigured: isGoogleAuthConfigured(),
    isAdmin: Boolean(isAdmin),
  });
}
