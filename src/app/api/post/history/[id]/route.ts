import { NextRequest, NextResponse } from 'next/server';
import { MongoPostAnalysisHistoryRepository } from '@/infrastructure/repositories/mongo-post-analysis-history-repository';
import { getErrorMessage } from '@/utils/error';
import { checkAuth, getCurrentUser, isAdminAccessAllowed } from '@/services/auth-service';
import { publishPostAnalysisHistoryChanged } from '@/services/realtime/post-analysis-events';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { authorized } = await checkAuth();
    if (!authorized) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = await getCurrentUser();
    const isAdmin = isAdminAccessAllowed(user);
    if (!isAdmin) {
      return NextResponse.json({ message: 'adminOnlyAction' }, { status: 403 });
    }

    const { id } = await context.params;
    const repository = new MongoPostAnalysisHistoryRepository();
    const deleted = await repository.delete(id);

    if (!deleted) {
      return NextResponse.json({ message: 'historyItemNotFound' }, { status: 404 });
    }

    await publishPostAnalysisHistoryChanged('deleted', { id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error, 'cannotDeleteHistory') },
      { status: 400 }
    );
  }
}
