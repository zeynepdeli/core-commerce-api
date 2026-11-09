import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { SELLABLE_VARIANT } from '../cart/cart.service.js';
import type { Env } from '../config/env.validation.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StoreSettingsService } from '../store-settings/store-settings.service.js';

import { ConsentsService } from './consents.service.js';

const BATCH = 100;
/** Bundan eski sepetler hatırlatılmaz */
const MAX_AGE_DAYS = 7;
/** Bir kişiye en fazla bu sıklıkta hatırlatma */
const MIN_GAP_DAYS = 7;

/**
 * Sepette ürün bırakan ÜYELERE hatırlatma. Ticari elektronik ileti olduğu için yalnızca
 * e-posta izni (İYS) en son "verildi" olanlara gider; her e-postada tek tıkla ret bağlantısı
 * vardır. Misafir sepetlerinin sahibi bilinmediği için gönderilmez. Mağaza ayarından açılır.
 */
@Injectable()
export class CartRemindersService {
  private readonly logger = new Logger(CartRemindersService.name);
  private readonly storefront: string;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly settings: StoreSettingsService,
    private readonly consents: ConsentsService,
    config: ConfigService<Env, true>,
  ) {
    this.storefront = config.get('STOREFRONT_URL', { infer: true }).replace(/\/$/, '');
  }

  @Cron('*/15 * * * *', { name: 'cart-reminders' })
  async run() {
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.sendDue();
    } finally {
      this.running = false;
    }
  }

  async sendDue(now = new Date()) {
    const s = await this.settings.seller();
    if (!s.abandonedCartEnabled) return 0;
    const idleSince = new Date(now.getTime() - s.abandonedCartDelayHours * 3_600_000);
    const oldest = new Date(now.getTime() - MAX_AGE_DAYS * 86_400_000);

    const carts = await this.prisma.cart.findMany({
      where: { userId: { not: null }, updatedAt: { lt: idleSince, gt: oldest }, items: { some: {} } },
      select: {
        id: true,
        updatedAt: true,
        reminderSentAt: true,
        user: { select: { id: true, email: true, name: true, isActive: true, deletedAt: true, emailVerifiedAt: true } },
        items: { select: { quantity: true, variant: { select: { name: true, stock: true, trackStock: true, product: { select: { name: true } } } } }, where: { variant: SELLABLE_VARIANT } },
      },
      orderBy: { updatedAt: 'asc' },
      take: BATCH,
    });

    let sent = 0;
    for (const cart of carts) {
      const u = cart.user;
      // Sepet son hatırlatmadan beri değişmediyse tekrar gönderilmez
      if (!u || !u.isActive || u.deletedAt || !u.emailVerifiedAt || (cart.reminderSentAt && cart.reminderSentAt >= cart.updatedAt)) continue;
      if (!cart.items.length) continue;
      if (!(await this.consents.granted(u.email, 'EMAIL', u.id))) continue;
      // Bu arada sipariş verdiyse (ödeme bekleyen dahil) hatırlatma yok
      const ordered = await this.prisma.order.count({ where: { userId: u.id, createdAt: { gte: cart.updatedAt } } });
      if (ordered) continue;
      const recent = await this.prisma.marketingMessage.count({ where: { type: 'CART_REMINDER', userId: u.id, sentAt: { gt: new Date(now.getTime() - MIN_GAP_DAYS * 86_400_000) } } });
      if (recent) continue;

      // Önce işaretle (updatedAt korunur: hatırlatma sepeti "değiştirmiş" sayılmasın)
      const { count } = await this.prisma.cart.updateMany({
        where: { id: cart.id, updatedAt: cart.updatedAt },
        data: { reminderSentAt: now, updatedAt: cart.updatedAt },
      });
      if (count === 0) continue;

      const lines = cart.items.map((i) => `- ${i.variant.product.name} (${i.variant.name}) × ${i.quantity}${i.variant.trackStock && i.variant.stock < i.quantity ? ' — stok azaldı' : ''}`).join('\n');
      this.mail.sendInBackground({
        to: u.email,
        subject: 'Sepetinizde ürünler sizi bekliyor',
        text: [
          `Merhaba ${u.name},`,
          '',
          'Sepetinizde bıraktığınız ürünler:',
          lines,
          '',
          `Alışverişinize kaldığınız yerden devam edin: ${this.storefront}/sepet`,
          '',
          s.sellerName ?? '',
          '',
          '—',
          'Bu ticari elektronik iletiyi, e-posta ile bilgilendirme izni verdiğiniz için aldınız.',
          `Bu tür e-postaları almak istemiyorsanız: ${this.storefront}/ileti-izni#t=${this.consents.unsubscribeToken(u.email)}`,
          s.sellerName && s.sellerAddress ? `${s.sellerName} · ${s.sellerAddress}` : '',
        ]
          .filter((l, i, a) => l !== '' || a[i - 1] !== '')
          .join('\n'),
      });
      await this.prisma.marketingMessage.create({ data: { type: 'CART_REMINDER', email: u.email, userId: u.id, refId: cart.id } });
      sent++;
    }
    if (sent) this.logger.log(`${sent} sepet hatırlatması gönderildi.`);
    return sent;
  }
}
