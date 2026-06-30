import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { checkAuth } from "@/services/auth-service";
import { steamScanRateLimiter } from "@/infrastructure/rate-limiter";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import {
  getInMemoryJob,
  setInMemoryJob,
  createScanJob,
} from "@/services/scan-job-store";
import { runScanJob } from "@/services/scan-service";
import { resolveSteamId } from "@/infrastructure/steam";
import { mergeIncomingCookieWithExisting } from "@/utils/steam-cookies";
import { decrypt } from "@/services/crypto-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ message: "missingJobId" }, { status: 400 });
  }

  const { ownerId } = await checkAuth();
  let job = getInMemoryJob(jobId);
  if (!job) {
    try {
      const db = await getDatabase();
      const doc = await db.collection("scan_jobs").findOne({ id: jobId });
      if (doc) {
        job = {
          id: doc.id,
          ownerId: typeof doc.ownerId === "string" ? doc.ownerId : "",
          status: doc.status,
          percent: doc.percent,
          message: doc.message,
          stage: doc.stage,
          result: doc.result,
          error: doc.error,
          detail: doc.detail,
          createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
          updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
        };
        // Restore to in-memory cache
        setInMemoryJob(jobId, job);
      }
    } catch (err) {
      console.error(`[MongoDB] Failed to query scan job ${jobId} from DB:`, err);
    }
  }

  if (!job) {
    return NextResponse.json(
      { message: "jobNotFound" },
      { status: 404 },
    );
  }

  if (!job.ownerId || job.ownerId !== ownerId) {
    return NextResponse.json(
      { message: "jobNotFound" },
      { status: 404 },
    );
  }

  return NextResponse.json(job);
}

export async function POST(request: Request) {
  try {
    const { ownerId } = await checkAuth();
    const scanOwnerId = ownerId;

    const ip = request.headers.get("x-forwarded-for") || "unknown-ip";
    const { allowed, retryAfter } = await steamScanRateLimiter.check(ip);
    if (!allowed) {
      return NextResponse.json(
        { message: "tooManyRequests", details: { retryAfter } },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const body = await request.json();
    const { steamUrl, steamCookie, forceRefresh, progress } = body;

    if (!steamUrl || typeof steamUrl !== "string" || !steamUrl.trim()) {
      return NextResponse.json(
        { message: "missingSteamLink" },
        { status: 400 },
      );
    }

    let finalCookie = steamCookie;
    if (steamCookie && steamUrl) {
      try {
        const resolved = await resolveSteamId(steamUrl);
        const db = await getDatabase();
        const existingAccount = await db.collection("portfolio_accounts").findOne({
          ownerId: scanOwnerId,
          steamId64: resolved.steamId64,
        });
        if (existingAccount?.steamCookie) {
          const decryptedExisting = decrypt(existingAccount.steamCookie);
          finalCookie = mergeIncomingCookieWithExisting(steamCookie, decryptedExisting);
        }
      } catch (err) {
        console.error("Failed to merge incoming cookie with DB on scan:", err);
      }
    }

    if (progress) {
      const jobId = crypto.randomUUID();
      await createScanJob(jobId, {
        id: jobId,
        ownerId: scanOwnerId,
        status: "queued",
        percent: 0,
        message: "waitingScan",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Run background job asynchronously
      runScanJob(jobId, { steamUrl, steamCookie: finalCookie, forceRefresh, ownerId: scanOwnerId });

      return NextResponse.json({ jobId });
    }

    // Sync flow (fallback/fallback client)
    const jobId = crypto.randomUUID();
    await createScanJob(jobId, {
      id: jobId,
      ownerId: scanOwnerId,
      status: "queued",
      percent: 0,
      message: "waitingScan",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await runScanJob(jobId, { steamUrl, steamCookie: finalCookie, forceRefresh, ownerId: scanOwnerId });
    const job = getInMemoryJob(jobId);

    if (job?.status === "error") {
      return NextResponse.json({ message: job.error }, { status: 400 });
    }
    return NextResponse.json(job?.result);
  } catch (error) {
    console.error("Scan route error:", error);
    return NextResponse.json(
      { message: "errScanInventory" },
      { status: 500 },
    );
  }
}
