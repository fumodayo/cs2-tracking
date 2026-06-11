import { NextResponse } from "next/server";
import {
  getCurrentUser,
  isGoogleAuthConfigured,
} from "@/services/auth-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    user: await getCurrentUser(),
    googleConfigured: isGoogleAuthConfigured(),
  });
}
