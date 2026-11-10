import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { fromKurus, type Kurus, toKurus } from '../commerce/money.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { IyzicoClient } from './iyzico.client.js';

export const REFUND_PATH = '/payment/refund';
export const CANCEL_PATH = '/payment/cancel';

type TxItem = { itemId: string; paymentTransactionId: string; price: string; refunded?: string };
export type PaymentSummary = { paymentId?: string; items?: TxItem[]; [key: string]: unknown };
export type RefundPart = { key: string; itemId: string; amount: Kurus };

/**
 * iyzico iadeleri. iyzico iadeyi sepet kalemi (paymentTransactionId) bazında yapar;
 * her kalemde iade edilen tutar ödeme kaydında tutulur, kalem tutarı asla aşılmaz.
 * Kart bilgisi kullanılmaz; yalnızca iyzico'nun verdiği işlem numaraları.
 */
@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly iyzico: IyzicoClient,
  ) {}

  /** Siparişin ödemesi iyzico ile otomatik iade edilebilir mi */
  async autoRefundable(orderId: string) {
    const p = await this.prisma.payment.findUnique({ where: { orderId }, select: { provider: true, status: true, providerRawResponse: true } });
    const summary = p?.providerRawResponse as PaymentSummary | null;
    return !!p && p.provider === 'iyzico' && p.status === 'SUCCEEDED' && this.iyzico.enabled && !!summary?.items?.length;
  }

  /**
   * Kalem kalem kısmi iade. Biri başarısız olursa durur; başarılı olanların anahtarlarını
   * döner (yarıda kalan iade tekrar denendiğinde aynı kalem ikinci kez iade edilmez).
   */
  async refundParts(orderId: string, parts: RefundPart[], ip?: string): Promise<{ done: string[]; error?: string }> {
    const done: string[] = [];
    for (const part of parts) {
      if (part.amount <= 0) {
        done.push(part.key);
        continue;
      }
      const payment = await this.prisma.payment.findUnique({ where: { orderId } });
      const summary = (payment?.providerRawResponse ?? {}) as PaymentSummary;
      const tx = summary.items?.find((i) => i.itemId === part.itemId);
      if (!payment || !tx) return { done, error: 'Ödeme kalemi bulunamadı; iadeyi iyzico panelinden yapın.' };
      const remaining = toKurus(tx.price) - toKurus(tx.refunded ?? '0');
      if (part.amount > remaining) return { done, error: 'İade tutarı ödenen kalem tutarını aşıyor.' };

      const response = await this.iyzico.post(REFUND_PATH, {
        locale: 'tr',
        conversationId: randomUUID(),
        paymentTransactionId: tx.paymentTransactionId,
        price: fromKurus(part.amount),
        currency: 'TRY',
        ip: ip ?? '127.0.0.1',
      });
      if (response.status !== 'success') {
        return { done, error: String(response.errorMessage ?? 'iyzico iadeyi kabul etmedi.').slice(0, 300) };
      }
      tx.refunded = fromKurus(toKurus(tx.refunded ?? '0') + part.amount);
      const fully = summary.items?.every((i) => toKurus(i.refunded ?? '0') >= toKurus(i.price));
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { providerRawResponse: summary as Prisma.InputJsonValue, ...(fully ? { status: 'REFUNDED', refundedAt: new Date() } : {}) },
      });
      done.push(part.key);
    }
    return { done };
  }

  /** Siparişin tamamı (ör. kargodan önce iptal): önce iptal, olmazsa kalan tüm kalemler iade */
  async refundAll(orderId: string, ip?: string): Promise<{ ok: boolean; error?: string }> {
    const payment = await this.prisma.payment.findUnique({ where: { orderId } });
    const summary = (payment?.providerRawResponse ?? {}) as PaymentSummary;
    if (!payment || payment.status !== 'SUCCEEDED' || !summary.items?.length) return { ok: false, error: 'Otomatik iade için ödeme bilgisi yok.' };

    const untouched = summary.items.every((i) => !i.refunded || i.refunded === '0.00');
    if (untouched && summary.paymentId) {
      // Aynı gün (gün sonu öncesi) iptal: müşteriye hiç çekilmemiş gibi yansır
      const r = await this.iyzico.post(CANCEL_PATH, { locale: 'tr', conversationId: randomUUID(), paymentId: summary.paymentId, ip: ip ?? '127.0.0.1' });
      if (r.status === 'success') {
        for (const i of summary.items) i.refunded = i.price;
        await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED', refundedAt: new Date(), providerRawResponse: summary as Prisma.InputJsonValue } });
        return { ok: true };
      }
      this.logger.log(`iyzico iptal olmadı (${String(r.errorCode ?? '')}), kalem kalem iade deneniyor`);
    }
    const parts = summary.items.map((i) => ({ key: i.itemId, itemId: i.itemId, amount: toKurus(i.price) - toKurus(i.refunded ?? '0') }));
    const result = await this.refundParts(orderId, parts, ip);
    return result.error ? { ok: false, error: result.error } : { ok: true };
  }
}
