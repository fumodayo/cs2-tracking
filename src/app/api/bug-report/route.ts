import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdminUser } from '@/services/auth-service';
import { getDatabase } from '@/infrastructure/db/mongo-client';
import { uploadImageToCloudinary } from '@/infrastructure/cloudinary';
import { ObjectId } from 'mongodb';
import { bugReportRateLimiter } from '@/infrastructure/rate-limiter';
import { bugReportSchema } from '@/utils/validation';
import { apiError, ApiErrorCode } from '@/utils/error';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for') ||
      (request as NextRequest & { ip?: string }).ip ||
      'unknown-ip';
    const { allowed, retryAfter } = await bugReportRateLimiter.check(ip);
    if (!allowed) {
      return apiError(ApiErrorCode.RATE_LIMIT_EXCEEDED, 'tooManyRequests', 429, { retryAfter });
    }

    const body = await request.json();
    const parsed = bugReportSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(ApiErrorCode.VALIDATION_ERROR, parsed.error.issues[0].message, 400);
    }
    const { description, image, mimeType, images } = parsed.data;

    let imageUrl = '';
    const imageUrls: string[] = [];

    // Hỗ trợ tải lên nhiều ảnh
    if (images && Array.isArray(images) && images.length > 0) {
      try {
        for (const imgObj of images) {
          if (imgObj.base64 && typeof imgObj.base64 === 'string' && imgObj.base64.trim()) {
            const resolvedMime = imgObj.mimeType || 'image/png';
            const uploadedUrl = await uploadImageToCloudinary(imgObj.base64, resolvedMime);
            imageUrls.push(uploadedUrl);
          }
        }
        if (imageUrls.length > 0) {
          imageUrl = imageUrls[0]; // Dự phòng cho mã cũ
        }
      } catch (uploadError) {
        console.error('Failed to upload screenshots to Cloudinary:', uploadError);
        return apiError(ApiErrorCode.INTERNAL_SERVER_ERROR, 'cloudinaryUploadError', 500);
      }
    } else if (image && typeof image === 'string' && image.trim()) {
      // Hỗ trợ ảnh đơn theo luồng cũ
      try {
        const resolvedMimeType = mimeType || 'image/png';
        imageUrl = await uploadImageToCloudinary(image, resolvedMimeType);
        imageUrls.push(imageUrl);
      } catch (uploadError) {
        console.error('Failed to upload screenshot to Cloudinary:', uploadError);
        return apiError(ApiErrorCode.INTERNAL_SERVER_ERROR, 'cloudinaryUploadError', 500);
      }
    }

    const user = await getCurrentUser();
    const db = await getDatabase();

    const report = {
      description: description.trim(),
      imageUrl: imageUrl || null,
      imageUrls: imageUrls.length > 0 ? imageUrls : imageUrl ? [imageUrl] : [],
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
          }
        : null,
      createdAt: new Date(),
    };

    const result = await db.collection('bug_reports').insertOne(report);

    return NextResponse.json({ success: true, id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Bug report submission error:', error);
    const message = error instanceof Error ? error.message : 'unknownError';
    return apiError(ApiErrorCode.INTERNAL_SERVER_ERROR, message, 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdminUser(user.email)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get('all') === 'true';

    const db = await getDatabase();
    const query = showAll ? {} : { status: { $ne: 'resolved' } };

    const reports = await db
      .collection('bug_reports')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Chuyển ObjectId thành chuỗi
    const serializedReports = reports.map((r) => ({
      ...r,
      id: r._id.toString(),
      _id: undefined,
    }));

    return NextResponse.json(serializedReports);
  } catch (error) {
    console.error('Failed to fetch bug reports:', error);
    const message = error instanceof Error ? error.message : 'unknownError';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdminUser(user.email)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ message: 'missingId' }, { status: 400 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'invalidId' }, { status: 400 });
    }

    const db = await getDatabase();
    const result = await db
      .collection('bug_reports')
      .updateOne({ _id: new ObjectId(id) }, { $set: { status, updatedAt: new Date() } });

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: 'notFound' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update bug report status:', error);
    const message = error instanceof Error ? error.message : 'unknownError';
    return NextResponse.json({ message }, { status: 500 });
  }
}
