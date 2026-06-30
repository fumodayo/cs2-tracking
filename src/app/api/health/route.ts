import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { getCurrentUser, isAdminUser } from "@/services/auth-service";
import { logger } from "@/utils/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    let dbStatus = "unknown";
    let mongoLatencyMs: number | null = null;
    let detailInfo: Record<string, any> | null = null;

    // Check authorization for detailed output
    const currentUser = await getCurrentUser();
    const isAdmin = currentUser ? isAdminUser(currentUser.email) : false;

    const dbStartTime = Date.now();
    try {
      const db = await getDatabase();
      if (isAdmin) {
        // Run a real query if admin requested detailed diagnostics
        await db.command({ ping: 1 });
        dbStatus = "healthy";
      } else {
        // Just verify connection exists without running query
        dbStatus = db ? "connected" : "disconnected";
      }
      mongoLatencyMs = Date.now() - dbStartTime;
    } catch (dbError) {
      dbStatus = "unhealthy";
      logger.error("Healthcheck MongoDB Connection/Ping Error", dbError, "HealthcheckRoute");
    }

    if (isAdmin) {
      detailInfo = {
        mongodb: {
          status: dbStatus,
          latencyMs: mongoLatencyMs,
        },
        env: {
          MONGODB_URI: process.env.MONGODB_URI ? "configured" : "missing",
          CS2CAP_API_KEY: process.env.CS2CAP_API_KEY ? "configured" : "missing",
          GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? "configured" : "missing",
          GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? "configured" : "missing",
          AUTH_SECRET: process.env.AUTH_SECRET ? "configured" : "missing",
          NODE_ENV: process.env.NODE_ENV,
        },
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      };
    }

    const overallStatus = dbStatus === "healthy" || dbStatus === "connected" ? "healthy" : "unhealthy";
    const httpStatus = overallStatus === "healthy" ? 200 : 500;

    return NextResponse.json(
      {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        ...(detailInfo ? { details: detailInfo } : {}),
      },
      { status: httpStatus }
    );
  } catch (error: any) {
    logger.error("Healthcheck Global Error", error, "HealthcheckRoute");
    return NextResponse.json(
      { status: "unhealthy", message: error.message },
      { status: 500 }
    );
  }
}
