import { validateEnv } from './env.validation.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(64),
  CORS_ORIGINS: 'http://localhost:3000, http://localhost:3001',
};

describe('validateEnv', () => {
  it('geçerli yapılandırmayı kabul eder, CORS listesini ayırır', () => {
    const env = validateEnv(base);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'http://localhost:3001']);
    expect(env.PORT).toBe(4000);
  });

  it('kısa JWT_SECRET ile başlamaz', () => {
    expect(() => validateEnv({ ...base, JWT_SECRET: 'kisa' })).toThrow(/JWT_SECRET/);
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
        CORS_ORIGINS: 'https://magaza.com,https://admin.magaza.com',
        WEB_API_SECRET: 's'.repeat(32),
      }),
    ).not.toThrow();
  });
});
