import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { fromKurus, toKurus } from '../commerce/money.js';
import type { Env } from '../config/env.validation.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StoreSettingsService } from '../store-settings/store-settings.service.js';

const tl = (v: { toFixed(d: number): string }) => `${fromKurus(toKurus(v)).replace('.', ',')} ₺`;

/**
 * Sipariş e-postaları (düz metin). Arka planda gönderilir; e-posta hatası
 * sipariş işlemini bozmaz. Kişisel veri en az düzeyde: kimlik/vergi no yazılmaz.
 */
@Injectable()
export class OrderMailService {
  private readonly storefront: string;
  private readonly adminUrl: string;
  private readonly notifyTo?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly settings: StoreSettingsService,
    config: ConfigService<Env, true>,
  ) {
    this.storefront = config.get('STOREFRONT_URL', { infer: true }).replace(/\/$/, '');
    this.adminUrl = config.get('ADMIN_URL', { infer: true }).replace(/\/$/, '');
    this.notifyTo = config.get('ORDER_NOTIFY_EMAIL', { infer: true });
  }

  async paid(orderId: string) {
    const o = await this.load(orderId);
    if (!o) return;
    const lines = o.items.map((i) => `- ${i.productName} (${i.variantName}) × ${i.quantity} — ${tl(i.price)}`).join('\n');
    this.mail.sendInBackground({
      to: o.email,
      subject: `Siparişiniz alındı (${o.orderNumber})`,
      text: [
        `Merhaba ${(o.shippingAddress as { fullName?: string }).fullName ?? ''},`,
        '',
        `${o.orderNumber} numaralı siparişinizin ödemesi alındı. Hazırlanmaya başlandığında ve kargoya verildiğinde size haber vereceğiz.`,
        '',
        lines,
        '',
        `Toplam: ${tl(o.total)}`,
        '',
        o.userId ? `Siparişinizi hesabınızdan takip edebilirsiniz: ${this.storefront}/hesabim/siparisler/${o.orderNumber}` : `Sipariş no: ${o.orderNumber}`,
      ].join('\n'),
    });
    const seller = await this.settings.seller();
    const to = this.notifyTo ?? seller.sellerEmail;
    if (to) {
      this.mail.sendInBackground({
        to,
        subject: `Yeni sipariş: ${o.orderNumber} — ${tl(o.total)}`,
        text: `Yeni bir sipariş ödendi.\n\n${lines}\n\nToplam: ${tl(o.total)}\n\nAdmin: ${this.adminUrl}/orders/${o.id}`,
      });
    }
  }

  async shipped(orderId: string) {
    const o = await this.load(orderId);
    if (!o) return;
    this.mail.sendInBackground({
      to: o.email,
      subject: `Siparişiniz kargoya verildi (${o.orderNumber})`,
      text: `Siparişiniz ${o.shippingCarrier ?? 'kargo firmasına'} teslim edildi.\nTakip numarası: ${o.trackingNumber ?? '-'}\n\nSipariş no: ${o.orderNumber}`,
    });
  }

  async cancelled(orderId: string, reason: string) {
    const o = await this.load(orderId);
    // Hiç ödenmemiş (süresi dolan) siparişte müşteriye e-posta atılmaz
    if (!o || !o.paidAt) return;
    this.mail.sendInBackground({
      to: o.email,
      subject: `Siparişiniz iptal edildi (${o.orderNumber})`,
      text: `${o.orderNumber} numaralı siparişiniz iptal edildi.\nNeden: ${reason}\n\nÖdemeniz iade edilecektir; bankanıza bağlı olarak hesabınıza yansıması birkaç iş günü sürebilir.`,
    });
  }

  /** Yöneticiyi uyar (ör. iptal edilmiş siparişe ödeme geldi) */
  async alertAdmin(subject: string, text: string) {
    const seller = await this.settings.seller();
    const to = this.notifyTo ?? seller.sellerEmail;
    if (to) this.mail.sendInBackground({ to, subject, text });
  }

  private load(id: string) {
    return this.prisma.order.findUnique({ where: { id }, include: { items: true } });
  }
}
