import z from 'zod';

const MAX_BUG_REPORT_IMAGES = 5;
const MAX_BUG_REPORT_IMAGE_BYTES = 5 * 1024 * 1024;

const imageMimeSchema = z
  .string()
  .trim()
  .regex(/^image\/(?:png|jpe?g|webp)$/i, 'invalidImageFormat');

const getBase64Payload = (value: string) => {
  const trimmed = value.trim();
  return trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : trimmed;
};

const getBase64ByteLength = (payload: string) => {
  const normalized = payload.replace(/\s/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
};

const imageBase64Schema = z
  .string()
  .trim()
  .min(1, 'imageDataRequired')
  .superRefine((value, ctx) => {
    const payload = getBase64Payload(value);
    if (!/^[a-z0-9+/=\r\n]+$/i.test(payload)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'invalidImageData',
      });
      return;
    }

    if (getBase64ByteLength(payload) > MAX_BUG_REPORT_IMAGE_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'imageTooLarge',
      });
    }
  });

/**
 * Schema Zod cho đầu vào tài khoản Steam khi tạo hoặc cập nhật.
 */
export const steamAccountSchema = z.object({
  steamUrl: z
    .string()
    .trim()
    .regex(
      /^https?:\/\/(?:www\.)?steamcommunity\.com\/(?:id|profiles)\/[a-zA-Z0-9_-]+\/?$/i,
      'steamUrlInvalid'
    ),
  steamCookie: z.string().trim().optional(),
  name: z.string().trim().min(1, 'accountNameRequired').max(100).optional(),
});

/**
 * Schema Zod cho đầu vào giao dịch vật phẩm portfolio.
 */
export const portfolioItemSchema = z.object({
  caseId: z.string().trim().min(1, 'caseIdRequired'),
  quantity: z.number().int('quantityMustBeInteger').positive('quantityMustBePositive'),
  buyPrice: z.number().positive('buyPriceMustBePositive').optional(),
  buyDate: z
    .string()
    .or(z.date())
    .transform((val) => new Date(val))
    .optional(),
  note: z.string().trim().max(1000).optional(),
  isTemporaryPrice: z.boolean().optional(),
  storageUnitId: z.string().trim().optional(),
  stickerPriceRate: z.number().min(0).optional(),
  stickerBuyPriceRate: z.number().min(0).optional(),
  stickerScanTotalPrice: z.number().min(0).optional(),
  stickerScanPriceCapturedAt: z
    .string()
    .or(z.date())
    .transform((val) => new Date(val))
    .optional(),
});

export const bugReportSchema = z.object({
  description: z.string().trim().min(3, 'descriptionRequired'),
  image: imageBase64Schema.optional(),
  mimeType: imageMimeSchema.optional(),
  images: z
    .array(
      z.object({
        base64: imageBase64Schema,
        mimeType: imageMimeSchema.optional(),
      })
    )
    .max(MAX_BUG_REPORT_IMAGES, 'tooManyImages')
    .optional(),
  status: z.string().trim().optional(),
});

/**
 * Schema Zod cho request phân tích bài viết Facebook.
 */
export const postAnalyzeSchema = z.object({
  text: z.string().trim().min(1, 'postContentRequired'),
  image: z
    .object({
      data: z.string().min(1, 'imageDataRequired'),
      mimeType: imageMimeSchema,
      fileName: z.string().trim().max(255).optional(),
    })
    .optional(),
  force: z.boolean().optional(),
});

/**
 * Schema Zod cho request validate CS2Cap API Key.
 */
export const cs2capValidateSchema = z.object({
  apiKey: z.string().trim().min(1, 'apiKeyRequired'),
});
