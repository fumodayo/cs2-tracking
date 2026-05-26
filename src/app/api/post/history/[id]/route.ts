import { NextRequest, NextResponse } from "next/server";
import { MongoPostAnalysisHistoryRepository } from "@/infrastructure/repositories/mongo-post-analysis-history-repository";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const repository = new MongoPostAnalysisHistoryRepository();
    const deleted = await repository.delete(id);

    if (!deleted) {
      return NextResponse.json({ message: "Không tìm thấy lịch sử phân tích." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 400 });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Không thể xóa lịch sử phân tích.";
}
