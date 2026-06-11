import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/services/auth-service";
import { getDatabase } from "@/infrastructure/db/mongo-client";
import { uploadImageToCloudinary } from "@/infrastructure/cloudinary";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, image, mimeType } = body;

    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json(
        { message: "Vui lòng nhập mô tả lỗi." },
        { status: 400 }
      );
    }

    let imageUrl = "";

    if (image && typeof image === "string" && image.trim()) {
      try {
        const resolvedMimeType = mimeType || "image/png";
        imageUrl = await uploadImageToCloudinary(image, resolvedMimeType);
      } catch (uploadError) {
        console.error("Failed to upload screenshot to Cloudinary:", uploadError);
        return NextResponse.json(
          { message: "Không thể upload hình ảnh lên Cloudinary." },
          { status: 500 }
        );
      }
    }

    const user = await getCurrentUser();
    const db = await getDatabase();

    const report = {
      description: description.trim(),
      imageUrl: imageUrl || null,
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
          }
        : null,
      createdAt: new Date(),
    };

    const result = await db.collection("bug_reports").insertOne(report);

    return NextResponse.json(
      { success: true, id: result.insertedId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Bug report submission error:", error);
    const message = error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.";
    return NextResponse.json(
      { message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.email !== "thaigiui2016@gmail.com") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get("all") === "true";

    const db = await getDatabase();
    const query = showAll ? {} : { status: { $ne: "resolved" } };

    const reports = await db
      .collection("bug_reports")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Serialize ObjectId to string
    const serializedReports = reports.map((r) => ({
      ...r,
      id: r._id.toString(),
      _id: undefined,
    }));

    return NextResponse.json(serializedReports);
  } catch (error) {
    console.error("Failed to fetch bug reports:", error);
    const message = error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.email !== "thaigiui2016@gmail.com") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { message: "Thiếu ID báo cáo lỗi." },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { message: "ID báo cáo lỗi không hợp lệ." },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const result = await db
      .collection("bug_reports")
      .updateOne({ _id: new ObjectId(id) }, { $set: { status, updatedAt: new Date() } });

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { message: "Không tìm thấy báo cáo lỗi." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update bug report status:", error);
    const message = error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

