import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { isIP } from 'node:net';
import { timingSafeEqual } from 'node:crypto';

/**
 * Hız sınırı kime göre sayılır?
 * Web sitesi (Next.js sunucusu) formları API'ye kendisi iletir; o zaman tüm
 * ziyaretçiler tek IP gibi görünür. Bu yüzden web sunucusu gerçek ziyaretçi
 * IP'sini X-Client-IP ile gönderir; API buna YALNIZCA doğru gizli anahtar
 * (X-Web-Secret = WEB_API_SECRET) geldiğinde güvenir. Aksi halde bağlantı IP'si.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, any>): Promise<string> {
    const secret = process.env.WEB_API_SECRET;
    const sent = req.headers?.['x-web-secret'];
    const clientIp = req.headers?.['x-client-ip'];

    if (
      secret &&
      secret.length >= 32 &&
      typeof sent === 'string' &&
      sent.length === secret.length &&
      timingSafeEqual(Buffer.from(sent), Buffer.from(secret)) &&
      typeof clientIp === 'string' &&
      isIP(clientIp)
    ) {
      return Promise.resolve(`web:${clientIp}`);
    }
    return Promise.resolve(req.ip as string);
  }
}
