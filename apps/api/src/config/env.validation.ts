import { z } from 'zod';

/**
 * Ortam değişkenleri uygulama açılırken doğrulanır. Eksik veya zayıf bir
 * değer varsa (ör. kısa JWT_SECRET) API HİÇ BAŞLAMAZ — yanlış yapılandırmayla
 * yayına çıkmaktansa açılmaması daha güvenlidir (OWASP A05).
 */
const csvUrls = z
  .string()
  .min(1)
  .transform((value) => value.split(',').map((item) => item.trim()).filter(Boolean))
  .pipe(z.array(z.url('CORS_ORIGINS içindeki her adres geçerli bir URL olmalıdır')).min(1));

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),

    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL zorunludur')
      .startsWith('postgresql://', { message: 'DATABASE_URL PostgreSQL bağlantısı olmalıdır' }),

    JWT_SECRET: z.string().min(64, 'JWT_SECRET en az 64 karakter olmalıdır'),

    // Tarayıcıdan doğrudan API'ye istek atmasına izin verilen adresler
    // (virgülle ayrılır). Mağaza ve admin, API'yi sunucu tarafından çağırdığı
    // için çoğu kurulumda yalnızca kendi adresleri yeterlidir.
    CORS_ORIGINS: csvUrls,

    // API önünde kaç güvenilir reverse proxy var (0 = yok). Yanlış değer,
    // hız sınırının herkesi tek IP sanmasına veya atlatılmasına yol açar.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),

    // Mağaza/admin sunucusu ↔ API ortak gizli anahtar. Sunucu tarafı isteklerde
    // gerçek ziyaretçi IP'si bu anahtarla imzalı başlıkla iletilir.
    WEB_API_SECRET: z.string().min(32, 'WEB_API_SECRET en az 32 karakter olmalıdır').optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    env.CORS_ORIGINS.forEach((origin, index) => {
      if (!origin.startsWith('https://')) {
        ctx.addIssue({
          code: 'custom',
          path: ['CORS_ORIGINS', index],
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

export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}
