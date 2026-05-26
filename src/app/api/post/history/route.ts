import { NextResponse } from "next/server";
import { MongoPostAnalysisHistoryRepository } from "@/infrastructure/repositories/mongo-post-analysis-history-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const repository = new MongoPostAnalysisHistoryRepository();
    const items = await repository.list(30);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 500 });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Không thể tải lịch sử phân tích.";
}
