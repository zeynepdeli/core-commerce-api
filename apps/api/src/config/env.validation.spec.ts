import { validateEnv } from './env.validation.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(64),
  ALLOWED_ORIGINS: 'http://localhost:3000, http://localhost:3001',
};

describe('validateEnv', () => {
  it('geçerli yapılandırmayı kabul eder, CORS listesini ayırır', () => {
    const env = validateEnv(base);
    expect(env.ALLOWED_ORIGINS).toEqual(['http://localhost:3000', 'http://localhost:3001']);
    expect(env.PORT).toBe(4000);
  });

  it('kısa veya eksik JWT_ACCESS_SECRET ile başlamaz; mesaj Türkçe ve değeri içermez', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'gizli-kisa' })).toThrow(/en az 64 karakter/);
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'gizli-kisa' })).not.toThrow(/gizli-kisa/);
    const { JWT_ACCESS_SECRET: _omit, ...missing } = base;
    expect(() => validateEnv(missing)).toThrow(/JWT_ACCESS_SECRET zorunludur/);
  });

  it('süreler ve argon2 alt sınırları', () => {
    const env = validateEnv(base);
    expect(env).toMatchObject({ JWT_ACCESS_TTL: '15m', JWT_REFRESH_TTL: '7d', ARGON2_MEMORY_COST: 19456, ARGON2_TIME_COST: 2 });
    expect(() => validateEnv({ ...base, JWT_ACCESS_TTL: '15 dakika' })).toThrow(/JWT_ACCESS_TTL/);
    expect(() => validateEnv({ ...base, ARGON2_MEMORY_COST: '1024' })).toThrow(/ARGON2_MEMORY_COST/);
  });

  it('PostgreSQL dışı veritabanı adresini reddeder', () => {
    expect(() => validateEnv({ ...base, DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });

  it('production: http CORS adresi ve eksik WEB_API_SECRET reddedilir', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(/HTTPS|WEB_API_SECRET/);
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: 'https://magaza.com,https://admin.magaza.com',
        WEB_API_SECRET: 's'.repeat(32),
        SMTP_HOST: 'smtp.example.com',
        SMTP_FROM: 'magaza@example.com',
        STOREFRONT_URL: 'https://magaza.com',
        ADMIN_URL: 'https://admin.magaza.com',
      }),
    ).not.toThrow();
  });

  it('production: SMTP ve https mağaza adresi zorunlu; SMTP_HOST varsa SMTP_FROM zorunlu', () => {
    expect(() => validateEnv({ ...base, SMTP_HOST: 'smtp.example.com' })).toThrow(/SMTP_FROM/);
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: 'https://magaza.com',
        WEB_API_SECRET: 's'.repeat(32),
      }),
    ).toThrow(/SMTP_HOST[\s\S]*STOREFRONT_URL/);
  });
});
