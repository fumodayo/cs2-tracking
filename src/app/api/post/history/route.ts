import { NextRequest, NextResponse } from "next/server";
import { MongoPostAnalysisHistoryRepository } from "@/infrastructure/repositories/mongo-post-analysis-history-repository";
import { getErrorMessage } from "@/utils/error";
import { checkAuth } from "@/services/auth-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { authorized } = await checkAuth();
    if (!authorized) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const postUrl = searchParams.get("postUrl");
    const fingerprint = searchParams.get("fingerprint");

    const repository = new MongoPostAnalysisHistoryRepository();

    if (postUrl) {
      const item = await repository.findByPostUrl(postUrl);
      return NextResponse.json({ item });
    }

    if (fingerprint) {
      const item = await repository.findByFingerprint(fingerprint);
      return NextResponse.json({ item });
    }

    const items = await repository.list(30);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, "cannotLoadHistory") },
      { status: 500 },
    );
  }
}
