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
    .min(1),
  ADMIN_EMAILS: z.string().optional().default(''),
  CS2CAP_API_KEY: z.string().optional().default(''),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  CLOUDINARY_URL: z.string().optional(),
});

const parseEnv = () => {
  const isTest = process.env.NODE_ENV === 'test';

  // During tests, we don't enforce strict validation to avoid mocking env vars in every unit test file
  if (isTest) {
    return process.env as unknown as z.infer<typeof envSchema>;
  }

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format());
    // Only crash on production runtime (avoid crashing during build time static checks if SKIP_ENV_VALIDATION is set)
    if (process.env.NODE_ENV === 'production' && !process.env.SKIP_ENV_VALIDATION) {
      throw new Error('Invalid environment variables. Startup halted.');
    }
    return process.env as unknown as z.infer<typeof envSchema>;
  }
  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
