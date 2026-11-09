import { createHash, randomBytes } from 'node:crypto';

/**
 * Tahmin edilemez tek kullanımlık değer (refresh token, e-posta doğrulama,
 * şifre sıfırlama). Kullanıcıya düz hali gider; veritabanında YALNIZCA
 * SHA-256 özeti tutulur — veritabanı sızsa bile token'lar kullanılamaz.
 * (256 bit rastgelelikte yavaş hash'e gerek yok; SHA-256 yeterli.)
 */
export function newSecureToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
