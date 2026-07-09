import { NextResponse } from 'next/server';
import { getDatabase } from '@/infrastructure/db/mongo-client';
import { getCurrentUser, isAdminUser } from '@/services/auth-service';
import { logger } from '@/utils/logger';

export const dynamic = 'force-dynamic';

type HealthDetails = {
  mongodb: {
    status: string;
    latencyMs: number | null;
  };
  env: Record<string, string | undefined>;
  uptime: number;
  memoryUsage: ReturnType<typeof process.memoryUsage>;
};

export async function GET() {
  try {
    let dbStatus = 'unknown';
    let mongoLatencyMs: number | null = null;
    let detailInfo: HealthDetails | null = null;

    // Kiểm tra quyền trước khi trả về chẩn đoán chi tiết
    const currentUser = await getCurrentUser();
    const isAdmin = currentUser ? isAdminUser(currentUser.email) : false;

    const dbStartTime = Date.now();
    try {
      const db = await getDatabase();
      if (isAdmin) {
        // Chạy truy vấn thật nếu admin yêu cầu chẩn đoán chi tiết
        await db.command({ ping: 1 });
        dbStatus = 'healthy';
      } else {
        // Chỉ xác minh kết nối tồn tại, không chạy truy vấn
        dbStatus = db ? 'connected' : 'disconnected';
      }
      mongoLatencyMs = Date.now() - dbStartTime;
    } catch (dbError) {
      dbStatus = 'unhealthy';
      logger.error('Healthcheck MongoDB Connection/Ping Error', dbError, 'HealthcheckRoute');
    }

    if (isAdmin) {
      detailInfo = {
        mongodb: {
          status: dbStatus,
          latencyMs: mongoLatencyMs,
        },
        env: {
          MONGODB_URI: process.env.MONGODB_URI ? 'configured' : 'missing',
          CS2CAP_API_KEY: process.env.CS2CAP_API_KEY ? 'configured' : 'missing',
          GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'missing',
          GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? 'configured' : 'missing',
          AUTH_SECRET: process.env.AUTH_SECRET ? 'configured' : 'missing',
          NODE_ENV: process.env.NODE_ENV,
        },
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      };
    }

    const overallStatus =
      dbStatus === 'healthy' || dbStatus === 'connected' ? 'healthy' : 'unhealthy';
    const httpStatus = overallStatus === 'healthy' ? 200 : 500;

    return NextResponse.json(
      {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        ...(detailInfo ? { details: detailInfo } : {}),
      },
      { status: httpStatus }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknownError';
    logger.error('Healthcheck Global Error', error, 'HealthcheckRoute');
    return NextResponse.json({ status: 'unhealthy', message }, { status: 500 });
  }
}
