import { NextRequest, NextResponse } from "next/server";
import { createServices } from "@/infrastructure/container";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("search") ?? "";
    const { caseRepository } = createServices();
    const cases = await caseRepository.search(query);

    return NextResponse.json({ cases });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 500 });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Không thể tải danh sách case.";
}
