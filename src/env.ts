import { z } from 'zod';

const envSchema = z.object({
  MONGODB_URI: z
    .string({
      message: 'MONGODB_URI is required',
    })
    .min(1),
  AUTH_SECRET: z
    .string({
      message: 'AUTH_SECRET is required',
    })
    .min(32, 'AUTH_SECRET must be at least 32 characters'),
  DATA_ENCRYPTION_KEY: z
    .string()
    .min(32, 'DATA_ENCRYPTION_KEY must be at least 32 characters')
    .optional(),
  MONGODB_DB: z.string().optional(),
  ADMIN_EMAILS: z.string().optional().default(''),
  CS2CAP_API_KEY: z.string().optional().default(''),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  CSFLOAT_API_KEY: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  ABLY_API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  SKIP_ENV_VALIDATION: z.string().optional(),
});

const parseEnv = () => {
  const isTest = process.env.NODE_ENV === 'test';
  const isProductionBuild = process.env.NEXT_PHASE === 'phase-production-build';

  // Trong test không ép validate nghiêm ngặt để tránh phải mock biến môi trường ở mọi file unit test
  if (isTest) {
    return process.env as unknown as z.infer<typeof envSchema>;
  }

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    if (!isProductionBuild) {
      console.error('Invalid environment variables:', result.error.format());
    }
    // Crash runtime production, but do not block static production build.
    if (
      process.env.NODE_ENV === 'production' &&
      !process.env.SKIP_ENV_VALIDATION &&
      !isProductionBuild
    ) {
      throw new Error('Invalid environment variables. Startup halted.');
    }
    return process.env as unknown as z.infer<typeof envSchema>;
  }
  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
