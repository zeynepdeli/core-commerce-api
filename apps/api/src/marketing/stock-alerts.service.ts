import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { SELLABLE_VARIANT } from '../cart/cart.service.js';
import type { Env } from '../config/env.validation.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StoreSettingsService } from '../store-settings/store-settings.service.js';

/** Bir e-postanın aynı anda bekleyebileceği en fazla talep (başkası adına toplu kayıt engeli) */
const MAX_PER_EMAIL = 10;
const BATCH = 200;
const RETENTION_DAYS = 180;

/**
 * "Stok gelince haber ver". Müşterinin kendi istediği tek seferlik bildirim olduğu için
 * ticari ileti izni gerektirmez; gönderilince talep kapanır. Yanıt her durumda aynıdır
 * (e-postanın kayıtlı olup olmadığı / önceden talep edilip edilmediği belli olmaz).
 */
@Injectable()
export class StockAlertsService {
  private readonly logger = new Logger(StockAlertsService.name);
  private readonly storefront: string;
  private readonly productPath: string;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly settings: StoreSettingsService,
    config: ConfigService<Env, true>,
  ) {
    this.storefront = config.get('STOREFRONT_URL', { infer: true }).replace(/\/$/, '');
    this.productPath = config.get('STOREFRONT_PRODUCT_PATH', { infer: true });
  }

  async subscribe(variantId: string, email: string, userId?: string) {
    const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, ...SELLABLE_VARIANT }, select: { stock: true, trackStock: true } });
    if (!variant) throw new NotFoundException('Ürün bulunamadı.');
    if (!variant.trackStock || variant.stock > 0) throw new BadRequestException('Bu ürün şu anda stokta; sepete ekleyebilirsiniz.');
    const normalized = email.trim().toLowerCase();
    const waiting = await this.prisma.stockAlert.count({ where: { email: normalized, notifiedAt: null } });
    if (waiting < MAX_PER_EMAIL) {
      await this.prisma.stockAlert.upsert({
        where: { variantId_email: { variantId, email: normalized } },
        create: { variantId, email: normalized, userId: userId ?? null },
        // Daha önce bildirildiyse yeniden açılır
        update: { notifiedAt: null, ...(userId ? { userId } : {}) },
      });
    }
    return { message: 'Tamam! Ürün yeniden stoğa girdiğinde size e-posta ile haber vereceğiz.' };
  }

  /** Stoğa giren varyantların bekleyen talepleri (10 dakikada bir) */
  @Cron('*/10 * * * *', { name: 'stock-alerts' })
  async run() {
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.notifyAvailable();
    } finally {
      this.running = false;
    }
  }

  async notifyAvailable() {
    const alerts = await this.prisma.stockAlert.findMany({
      where: { notifiedAt: null, variant: { ...SELLABLE_VARIANT, OR: [{ trackStock: false }, { stock: { gt: 0 } }] } },
      include: { variant: { select: { name: true, product: { select: { name: true, slug: true, variants: { where: { isActive: true, deletedAt: null }, select: { id: true } } } } } } },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
    });
    if (!alerts.length) return 0;
    const store = (await this.settings.seller()).sellerName ?? 'Mağazamız';
    let sent = 0;
    for (const a of alerts) {
      // Önce işaretle: iki iş aynı anda çalışsa da tek e-posta gider
      const { count } = await this.prisma.stockAlert.updateMany({ where: { id: a.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
      if (count === 0) continue;
      const p = a.variant.product;
      const name = p.variants.length > 1 ? `${p.name} (${a.variant.name})` : p.name;
      const link = `${this.storefront}${this.productPath.replace('{slug}', encodeURIComponent(p.slug))}${p.variants.length > 1 ? `?v=${a.variantId}` : ''}`;
      this.mail.sendInBackground({
        to: a.email,
        subject: `${name} yeniden stokta`,
        text: [
          'Merhaba,',
          '',
          `Haber vermemizi istediğiniz "${name}" yeniden stokta. Stoklar sınırlı olabilir:`,
          link,
          '',
          `${store}`,
          '',
          'Bu e-postayı, ürün sayfasında "Gelince haber ver" seçtiğiniz için aldınız. Tek seferliktir. Siz istemediyseniz dikkate almayın.',
        ].join('\n'),
      });
      await this.prisma.marketingMessage.create({ data: { type: 'STOCK_ALERT', email: a.email, userId: a.userId, refId: a.variantId } });
      sent++;
    }
    if (sent) this.logger.log(`${sent} stok bildirimi gönderildi.`);
    return sent;
  }

  /** Eski talepleri temizle (günde bir) */
  @Cron('30 3 * * *', { name: 'stock-alerts-cleanup' })
  async cleanup() {
    const before = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
    await this.prisma.stockAlert.deleteMany({ where: { createdAt: { lt: before } } });
  }
}
