import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';

import type { Env } from '../config/env.validation.js';
import type { ConsentChannel } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const CHANNELS: ConsentChannel[] = ['EMAIL', 'SMS'];

/**
 * Ticari elektronik ileti izinleri (6563 sayılı Kanun / İYS). İzin kayıtları silinmez,
 * her değişiklik yeni satırdır; geçerli durum = en son kayıt. Ret (abonelikten çıkma)
 * her iletideki bağlantıyla tek tıkla yapılabilir.
 */
@Injectable()
export class ConsentsService {
  private readonly key: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    // Ayrı amaçlı anahtar (JWT anahtarı doğrudan kullanılmaz)
    this.key = Buffer.from(hkdfSync('sha256', config.get('JWT_ACCESS_SECRET', { infer: true }), 'core-commerce', 'unsubscribe-v1', 32));
  }

  /** E-posta (ve varsa üye) için geçerli izin */
  async granted(email: string, channel: ConsentChannel, userId?: string | null): Promise<boolean> {
    const latest = await this.prisma.consentRecord.findFirst({
      where: { channel, OR: [{ email: email.toLowerCase() }, ...(userId ? [{ userId }] : [])] },
      orderBy: { createdAt: 'desc' },
      select: { granted: true },
    });
    return latest?.granted === true;
  }

  async status(userId: string, email: string) {
    const entries = await Promise.all(CHANNELS.map(async (c) => [c, await this.granted(email, c, userId)] as const));
    return { email: entries.find(([c]) => c === 'EMAIL')?.[1] ?? false, sms: entries.find(([c]) => c === 'SMS')?.[1] ?? false };
  }

  async set(userId: string, email: string, changes: { email?: boolean; sms?: boolean }, ipAddress?: string) {
    const current = await this.status(userId, email);
    const rows = (
      [
        ['EMAIL', changes.email, current.email],
        ['SMS', changes.sms, current.sms],
      ] as const
    )
      .filter(([, next, now]) => next !== undefined && next !== now)
      .map(([channel, granted]) => ({ userId, email: email.toLowerCase(), channel, granted: granted as boolean, source: 'account', ipAddress }));
    if (rows.length) await this.prisma.consentRecord.createMany({ data: rows });
    return this.status(userId, email);
  }

  // ───── Tek tıkla ret bağlantısı ─────

  /** "base64url(e-posta).imza": süresiz (ret bağlantısı her zaman çalışmalı), değiştirilemez */
  unsubscribeToken(email: string) {
    const e = Buffer.from(email.toLowerCase()).toString('base64url');
    return `${e}.${this.sign(e)}`;
  }

  async unsubscribe(token: string, ipAddress?: string) {
    const [e, sig] = token.split('.');
    if (!e || !sig || sig.length !== 43) throw new BadRequestException('Bağlantı geçersiz.');
    const expected = Buffer.from(this.sign(e));
    if (!timingSafeEqual(expected, Buffer.from(sig))) throw new BadRequestException('Bağlantı geçersiz.');
    const email = Buffer.from(e, 'base64url').toString('utf8');
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (await this.granted(email, 'EMAIL', user?.id)) {
      await this.prisma.consentRecord.create({ data: { userId: user?.id ?? null, email, channel: 'EMAIL', granted: false, source: 'unsubscribe-link', ipAddress } });
    }
    return { success: true };
  }

  private sign(payload: string) {
    return createHmac('sha256', this.key).update(payload).digest('base64url');
  }
}
