import { z } from 'zod';

/**
 * Ortam değişkenleri uygulama açılırken doğrulanır. Eksik veya zayıf bir
 * değer varsa (ör. kısa JWT_ACCESS_SECRET) API HİÇ BAŞLAMAZ — yanlış yapılandırmayla
 * yayına çıkmaktansa açılmaması daha güvenlidir (OWASP A05).
 */
const DURATION = /^\d{1,5}[smhd]$/;

const csvUrls = z
  .string({ error: 'ALLOWED_ORIGINS zorunludur (ör. http://localhost:3000,http://localhost:3001)' })
  .min(1, 'ALLOWED_ORIGINS boş olamaz')
  .transform((value) => value.split(',').map((item) => item.trim()).filter(Boolean))
  .pipe(z.array(z.url('ALLOWED_ORIGINS içindeki her adres geçerli bir URL olmalıdır')).min(1));

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),

    DATABASE_URL: z
      .string({ error: 'DATABASE_URL zorunludur' })
      .min(1, 'DATABASE_URL zorunludur')
      .startsWith('postgresql://', { message: 'DATABASE_URL PostgreSQL bağlantısı olmalıdır' }),

    // Kısa ömürlü erişim token'ını (JWT) imzalar. Refresh token JWT değildir:
    // rastgele üretilir, veritabanında yalnızca SHA-256 özeti tutulur.
    JWT_ACCESS_SECRET: z
      .string({ error: 'JWT_ACCESS_SECRET zorunludur (üretmek için: openssl rand -base64 64)' })
      .min(64, 'JWT_ACCESS_SECRET en az 64 karakter olmalıdır (openssl rand -base64 64)'),
    JWT_ACCESS_TTL: z.string().regex(DURATION, "JWT_ACCESS_TTL '15m' gibi olmalıdır").default('15m'),
    JWT_REFRESH_TTL: z.string().regex(DURATION, "JWT_REFRESH_TTL '7d' gibi olmalıdır").default('7d'),

    // Şifre özeti maliyeti. Alt sınırlar OWASP Password Storage önerisidir
    // (argon2id, en az 19 MiB bellek, 2 tur); düşürülemez.
    ARGON2_MEMORY_COST: z.coerce.number().int().min(19_456, 'ARGON2_MEMORY_COST en az 19456 olmalıdır').max(1_048_576).default(19_456),
    ARGON2_TIME_COST: z.coerce.number().int().min(2, 'ARGON2_TIME_COST en az 2 olmalıdır').max(10).default(2),

    // Tarayıcıdan doğrudan API'ye istek atmasına izin verilen adresler
    // (virgülle ayrılır). Mağaza ve admin, API'yi sunucu tarafından çağırdığı
    // için çoğu kurulumda yalnızca kendi adresleri yeterlidir.
    ALLOWED_ORIGINS: csvUrls,

    // API önünde kaç güvenilir reverse proxy var (0 = yok). Yanlış değer,
    // hız sınırının herkesi tek IP sanmasına veya atlatılmasına yol açar.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),

    // Mağaza/admin sunucusu ↔ API ortak gizli anahtar. Sunucu tarafı isteklerde
    // gerçek ziyaretçi IP'si bu anahtarla imzalı başlıkla iletilir.
    WEB_API_SECRET: z.string().min(32, 'WEB_API_SECRET en az 32 karakter olmalıdır').optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    env.ALLOWED_ORIGINS.forEach((origin, index) => {
      if (!origin.startsWith('https://')) {
        ctx.addIssue({
          code: 'custom',
          path: ['ALLOWED_ORIGINS', index],
          message: 'Production ortamında CORS adresleri HTTPS olmalıdır',
        });
      }
    });
    if (!env.WEB_API_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['WEB_API_SECRET'],
        message: 'Production ortamında WEB_API_SECRET zorunludur',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Hata varsa okunabilir, Türkçe ve değer İÇERMEYEN bir mesajla durur
 * (sırlar loglara düşmesin).
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (result.success) return result.data;
  const lines = result.error.issues.map((issue) => `  • ${issue.message}`);
  throw new Error(`Ortam değişkenleri hatalı (apps/api/.env dosyasını kontrol edin):\n${lines.join('\n')}`);
}
