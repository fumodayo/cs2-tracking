import { NextRequest, NextResponse } from "next/server";
import { searchCases } from "@/services/case-search";
import { getErrorMessage } from "@/utils/error";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("search") ?? "";
    const cases = await searchCases(query);
    return NextResponse.json({ cases });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "failedToLoadCases") },
      { status: 500 },
    );
  }
}
