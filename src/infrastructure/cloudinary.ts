import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  api_key: process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
  secure: true,
});

export async function uploadImageToCloudinary(
  base64Data: string,
  mimeType: string,
): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Vui lòng cấu hình CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, và CLOUDINARY_API_SECRET trong file .env để lưu ảnh inventory.",
    );
  }

  // Format base64 data to data URI format if not already formatted
  const cleanBase64 = base64Data.includes(",")
    ? (base64Data.split(",").pop() ?? "")
    : base64Data;
  const dataUri = `data:${mimeType};base64,${cleanBase64}`;

  try {
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "cs2-tracking/inventory-scans",
    });

    return result.secure_url;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Lỗi khi tải ảnh lên Cloudinary: ${message}`);
  }
}
