import { NextResponse } from "next/server";
import { getPortfolioOwnerId } from "@/services/auth-service";
import { getDatabase } from "@/infrastructure/db/mongo-client";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const ownerId = await getPortfolioOwnerId();
    const db = await getDatabase();

    // Auto-migrate legacy sync items that don't have sourceAccounts populated
    const legacySyncQuery = {
      ownerId,
      $or: [
        { note: { $regex: /Đồng bộ từ Lịch sử Trade/i } },
        { note: { $regex: /Đồng bộ từ Trade History/i } },
        { note: { $regex: /Trade History/i } },
      ],
      $and: [
        {
          $or: [
            { sourceAccounts: { $exists: false } },
            { sourceAccounts: { $size: 0 } },
            { sourceAccounts: null },
          ],
        },
      ],
    };

    const syncItems = await db
      .collection("portfolio_items")
      .find(legacySyncQuery)
      .toArray();

    let migratedCount = 0;

    if (syncItems.length > 0) {
      const accounts = await db
        .collection("portfolio_accounts")
        .find({
          $or: [
            { ownerId },
            ...(ownerId === "guest" ? [{ ownerId: { $exists: false } }] : []),
          ],
        })
        .toArray();

      if (accounts.length > 0) {
        // Fallback to the first linked account
        const primaryAccount = accounts[0];
        const sourceAccounts = [
          {
            steamId64: primaryAccount.steamId64,
            name: primaryAccount.name,
          },
        ];

        const updateResult = await db.collection("portfolio_items").updateMany(
          {
            _id: { $in: syncItems.map((item) => item._id) },
          },
          {
            $set: { sourceAccounts },
          },
        );
        migratedCount = updateResult.modifiedCount;
      }
    }

    return NextResponse.json({
      message: "Migration completed",
      migratedCount,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Migration failed" },
      { status: 500 },
    );
  }
}
