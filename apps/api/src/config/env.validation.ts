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
      .refine((url) => url.startsWith('postgresql://') || url.startsWith('postgres://'), {
        message: 'DATABASE_URL postgresql:// veya postgres:// ile başlamalı',
      }),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

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
    ARGON2_PARALLELISM: z.coerce.number().int().min(1).max(16).default(1),

    // Hesap kilitleme: art arda bu kadar hatalı şifreden sonra hesap kilitlenir
    MAX_FAILED_LOGIN_ATTEMPTS: z.coerce.number().int().min(3).max(10).default(5),
    LOCKOUT_DURATION_MINUTES: z.coerce.number().int().min(5).max(60).default(15),

    // E-postadaki bağlantıların açılacağı mağaza adresi (doğrulama, şifre sıfırlama)
    STOREFRONT_URL: z.url('STOREFRONT_URL geçerli bir URL olmalıdır').default('http://localhost:3000'),
    // Yöneticilerin şifre sıfırlama bağlantısı admin paneline gider
    ADMIN_URL: z.url('ADMIN_URL geçerli bir URL olmalıdır').default('http://localhost:3001'),

    // ───── E-posta (SMTP). Boşsa: geliştirmede e-posta konsola yazılır,
    // production'da API açılmaz (doğrulama/şifre sıfırlama çalışmaz).
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_SECURE: z.enum(['true', 'false']).default('false'),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.email('SMTP_FROM geçerli bir e-posta olmalıdır').optional(),

    // Görsellerin saklandığı yer: local (sunucu diski) | cloudinary (önerilen)
    MEDIA_STORAGE: z.enum(['local', 'cloudinary']).default('local'),
    CLOUDINARY_CLOUD_NAME: z.string().regex(/^[a-z0-9_-]{1,64}$/i, 'CLOUDINARY_CLOUD_NAME geçersiz').optional(),
    CLOUDINARY_API_KEY: z.string().regex(/^\d{6,20}$/, 'CLOUDINARY_API_KEY geçersiz').optional(),
    CLOUDINARY_API_SECRET: z.string().min(10).optional(),
    CLOUDINARY_FOLDER: z
      .string()
      .regex(/^[a-z0-9_-]{1,64}$/i, 'CLOUDINARY_FOLDER yalnızca harf, rakam, - ve _ içerebilir')
      .default('core-commerce'),

    // ───── Ödeme: iyzico (ikisi de boşsa online ödeme kapalı) ─────
    IYZICO_API_KEY: z.string().min(10).optional(),
    IYZICO_SECRET_KEY: z.string().min(10).optional(),
    IYZICO_BASE_URL: z.url('IYZICO_BASE_URL geçerli bir URL olmalıdır').default('https://sandbox-api.iyzipay.com'),
    // iyzico'nun ödeme sonucunu geri göndereceği, internetten erişilebilir API adresi
    API_PUBLIC_URL: z.url('API_PUBLIC_URL geçerli bir URL olmalıdır').optional(),
    // Yeni sipariş bildiriminin gideceği adres (boşsa mağaza bilgilerindeki e-posta)
    ORDER_NOTIFY_EMAIL: z.email('ORDER_NOTIFY_EMAIL geçerli bir e-posta olmalıdır').optional(),

    // ───── İki adımlı doğrulama (yönetici) ─────
    // TOTP gizli anahtarlarını şifreleyen anahtar (32 bayt, base64). Üretmek için: openssl rand -base64 32
    // Kaybolursa/değişirse herkesin 2FA kurulumu geçersiz olur (yedek kodlar yine çalışır).
    TWO_FACTOR_ENCRYPTION_KEY: z
      .string()
      .refine((v) => Buffer.from(v, 'base64').length === 32, 'TWO_FACTOR_ENCRYPTION_KEY 32 baytlık base64 olmalıdır (openssl rand -base64 32)')
      .optional(),
    // Yöneticiler 2FA kurmadan panele erişemesin. Boşsa: production'da açık, geliştirmede kapalı.
    ADMIN_2FA_REQUIRED: z.enum(['true', 'false']).optional(),

    // Google ile giriş (isteğe bağlı). Google Cloud Console → OAuth istemci kimliği.
    GOOGLE_CLIENT_ID: z
      .string()
      .regex(/^[\w-]+\.apps\.googleusercontent\.com$/, 'GOOGLE_CLIENT_ID geçersiz')
      .optional(),

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
    if (env.MEDIA_STORAGE === 'cloudinary') {
      for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: `MEDIA_STORAGE=cloudinary için ${key} zorunludur` });
      }
    }
    if (!!env.IYZICO_API_KEY !== !!env.IYZICO_SECRET_KEY) {
      ctx.addIssue({ code: 'custom', path: ['IYZICO_SECRET_KEY'], message: 'IYZICO_API_KEY ve IYZICO_SECRET_KEY birlikte girilmelidir' });
    }
    if (env.IYZICO_API_KEY && !env.API_PUBLIC_URL) {
      ctx.addIssue({ code: 'custom', path: ['API_PUBLIC_URL'], message: 'iyzico için API_PUBLIC_URL zorunludur (ödeme sonucu buraya döner)' });
    }
    if (env.SMTP_HOST && !env.SMTP_FROM) {
      ctx.addIssue({ code: 'custom', path: ['SMTP_FROM'], message: 'SMTP_HOST tanımlıysa SMTP_FROM zorunludur' });
    }
    if (env.NODE_ENV !== 'production') return;
    if (!env.TWO_FACTOR_ENCRYPTION_KEY) {
      ctx.addIssue({ code: 'custom', path: ['TWO_FACTOR_ENCRYPTION_KEY'], message: 'Production ortamında TWO_FACTOR_ENCRYPTION_KEY zorunludur (openssl rand -base64 32)' });
    }
    if (!env.SMTP_HOST) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message: 'Production ortamında SMTP_HOST zorunludur (e-posta doğrulama ve şifre sıfırlama için)',
      });
    }
    if (env.IYZICO_API_KEY && (!env.IYZICO_BASE_URL.startsWith('https://') || !env.API_PUBLIC_URL?.startsWith('https://'))) {
      ctx.addIssue({ code: 'custom', path: ['API_PUBLIC_URL'], message: 'Production ortamında iyzico ve API_PUBLIC_URL adresleri HTTPS olmalıdır' });
    }
    if (env.IYZICO_API_KEY?.startsWith('sandbox-') && env.IYZICO_BASE_URL.includes('sandbox') === false) {
      ctx.addIssue({ code: 'custom', path: ['IYZICO_BASE_URL'], message: 'Sandbox anahtarı canlı iyzico adresiyle kullanılamaz' });
    }
    if (!env.ADMIN_URL.startsWith('https://')) {
      ctx.addIssue({ code: 'custom', path: ['ADMIN_URL'], message: 'Production ortamında ADMIN_URL HTTPS olmalıdır' });
    }
    if (!env.STOREFRONT_URL.startsWith('https://')) {
      ctx.addIssue({ code: 'custom', path: ['STOREFRONT_URL'], message: 'Production ortamında STOREFRONT_URL HTTPS olmalıdır' });
    }
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
