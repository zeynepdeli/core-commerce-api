import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

type RequestLike = { ip?: string; headers?: Record<string, unknown> };

/**
 * İsteği yapan ziyaretçinin IP'si.
 * Mağaza/admin (Next.js sunucusu) istekleri API'ye kendisi iletir; o zaman
 * herkes tek IP gibi görünür. Bu yüzden sunucu gerçek IP'yi X-Client-IP ile
 * gönderir ve API buna YALNIZCA doğru gizli anahtar (X-Web-Secret =
 * WEB_API_SECRET) geldiğinde güvenir. Aksi halde bağlantı IP'si kullanılır.
 */
export function clientIp(req: RequestLike): { ip: string; viaFrontend: boolean } {
  const secret = process.env.WEB_API_SECRET;
  const sent = req.headers?.['x-web-secret'];
  const forwarded = req.headers?.['x-client-ip'];

  if (
    secret &&
    secret.length >= 32 &&
    typeof sent === 'string' &&
    sent.length === secret.length &&
    timingSafeEqual(Buffer.from(sent), Buffer.from(secret)) &&
    typeof forwarded === 'string' &&
    isIP(forwarded)
  ) {
    return { ip: forwarded, viaFrontend: true };
  }
  return { ip: req.ip ?? 'unknown', viaFrontend: false };
}

/** User-Agent: loglarda/oturum listesinde gösterilir; uzunluk sınırlı */
export function userAgent(req: RequestLike): string | undefined {
  const value = req.headers?.['user-agent'];
  return typeof value === 'string' ? value.slice(0, 255) : undefined;
}
