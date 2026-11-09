import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
      { message: 'DATABASE_URL postgresql:// veya postgres:// ile başlamalı' },
    ),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET en az 32 karakter olmalı'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET en az 32 karakter olmalı'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  ALLOWED_ORIGINS: z
    .string()
    .min(1)
    .transform((val) => val.split(',').map((origin) => origin.trim())),

  ARGON2_MEMORY_COST: z.coerce.number().int().min(15360).default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().min(2).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),

  MAX_FAILED_LOGIN_ATTEMPTS: z.coerce.number().int().min(3).max(10).default(5),
  LOCKOUT_DURATION_MINUTES: z.coerce.number().int().min(5).max(60).default(15),

  // TODO: Email doğrulama modülü yazılırken eklenecek:
  // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
  //
  // TODO: Yatay ölçekleme / rate limiting / token blacklist gerektiğinde eklenecek:
  // REDIS_URL
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `-${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Geçersiz ortam değişkenleri:\n${formatted}`);
  }

  const { data } = parsed;

  if (data.NODE_ENV === 'production' && data.ALLOWED_ORIGINS.includes('*')) {
    throw new Error('ALLOWED_ORIGINS production ortamında "*" içeremez.');
  }

  if (data.JWT_ACCESS_SECRET === data.JWT_REFRESH_SECRET) {
    throw new Error(
      'JWT_ACCESS_SECRET ve JWT_REFRESH_SECRET aynı değere sahip olamaz.',
    );
  }

  return data;
}
