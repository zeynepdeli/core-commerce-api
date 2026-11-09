import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { fromKurus, toKurus } from '../commerce/money.js';
import type { Env } from '../config/env.validation.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StoreSettingsService } from '../store-settings/store-settings.service.js';

const tl = (k: number) => `${fromKurus(k).replace('.', ',')} ₺`;

/** İade e-postaları (düz metin, arka planda) */
@Injectable()
export class ReturnMailService {
  private readonly adminUrl: string;
  private readonly notifyTo?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly settings: StoreSettingsService,
    config: ConfigService<Env, true>,
  ) {
    this.adminUrl = config.get('ADMIN_URL', { infer: true }).replace(/\/$/, '');
    this.notifyTo = config.get('ORDER_NOTIFY_EMAIL', { infer: true });
  }

  private async load(id: string) {
    const r = await this.prisma.returnRequest.findUnique({ where: { id }, include: { items: { include: { orderItem: true } }, order: { select: { orderNumber: true, email: true } } } });
    if (!r) return null;
    const lines = r.items.map((i) => `- ${i.orderItem.productName} (${i.orderItem.variantName}) × ${i.quantity}`).join('\n');
    const total = tl(toKurus(r.refundAmount) + toKurus(r.refundShipping));
    return { r, lines, total };
  }

  async requested(id: string) {
    const d = await this.load(id);
    if (!d) return;
    this.mail.sendInBackground({
      to: d.r.order.email,
      subject: `İade talebiniz alındı (${d.r.returnNumber})`,
      text: `${d.r.order.orderNumber} numaralı siparişiniz için iade talebiniz alındı.\n\n${d.lines}\n\nİade tutarı: ${d.total}\n\nTalebiniz incelendikten sonra ürünü nasıl göndereceğinizi size bildireceğiz. Lütfen bu e-postayı almadan ürünü göndermeyin.`,
    });
    const seller = await this.settings.seller();
    const to = this.notifyTo ?? seller.sellerEmail;
    if (to) {
      this.mail.sendInBackground({ to, subject: `Yeni iade talebi: ${d.r.returnNumber}`, text: `Sipariş ${d.r.order.orderNumber}\n\n${d.lines}\n\nİade tutarı: ${d.total}\n\nAdmin: ${this.adminUrl}/returns/${d.r.id}` });
    }
  }

  async approved(id: string) {
    const d = await this.load(id);
    if (!d) return;
    const seller = await this.settings.seller();
    this.mail.sendInBackground({
      to: d.r.order.email,
      subject: `İade talebiniz onaylandı (${d.r.returnNumber})`,
      text: [
        `${d.r.returnNumber} numaralı iade talebiniz onaylandı. Ürünü aşağıdaki adrese gönderebilirsiniz.`,
        '',
        d.r.adminNote ? `Mağazanın notu: ${d.r.adminNote}\n` : '',
        seller.sellerAddress ? `İade adresi: ${seller.sellerName ?? ''}\n${seller.sellerAddress}\n` : '',
        `Paketin içine iade numaranızı (${d.r.returnNumber}) yazmanız yeterli.`,
        `Ürün bize ulaştığında ${d.total} tutarındaki iadeniz ödeme yönteminize yapılır.`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  async rejected(id: string) {
    const d = await this.load(id);
    if (!d) return;
    this.mail.sendInBackground({
      to: d.r.order.email,
      subject: `İade talebiniz hakkında (${d.r.returnNumber})`,
      text: `${d.r.returnNumber} numaralı iade talebiniz kabul edilemedi.\n\nGerekçe: ${d.r.adminNote ?? '-'}\n\nSorularınız için bu e-postayı yanıtlayabilirsiniz.`,
    });
  }

  async refunded(id: string) {
    const d = await this.load(id);
    if (!d) return;
    this.mail.sendInBackground({
      to: d.r.order.email,
      subject: `İadeniz yapıldı (${d.r.returnNumber})`,
      text: `${d.total} tutarındaki iadeniz yapıldı. Bankanıza bağlı olarak hesabınıza/kartınıza yansıması birkaç iş günü sürebilir.\n\n${d.lines}`,
    });
  }
}
