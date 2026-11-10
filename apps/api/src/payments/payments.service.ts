import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { AuditService } from '../audit/audit.service.js';
import { hashToken } from '../auth/secure-token.js';
import { fromKurus, toKurus } from '../commerce/money.js';
import type { Env } from '../config/env.validation.js';
import { OrderMailService } from '../orders/order-mail.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { buildBasket, splitName } from './basket.js';
import { IyzicoClient, type IyzicoResponse } from '../iyzico/iyzico.client.js';

export const INIT_PATH = '/payment/iyzipos/checkoutform/initialize/auth/ecom';
export const RETRIEVE_PATH = '/payment/iyzipos/checkoutform/auth/ecom/detail';

/** iyzico ödeme sayfası token'ı 30 dk geçerli; sipariş bu sürede zaman aşımına düşmesin */
const PAYMENT_WINDOW_MS = 30 * 60_000;
/** Ödeme sayfası tekrar tekrar açılarak stok süresiz kilitlenemesin */
const MAX_HOLD_MS = 2 * 60 * 60_000;

export type PaymentOwner = { userId: string } | { guestAccessToken: string };
export type PaymentResult = { orderNumber: string; ok: boolean; reason?: string };

type Address = { fullName?: string; phone?: string; city?: string; district?: string; addressLine?: string; zipCode?: string };
type Billing = Address & { type?: 'INDIVIDUAL' | 'CORPORATE'; identityNumber?: string; companyName?: string };

/**
 * iyzico Ödeme Formu (Checkout Form). Kart bilgisi hiçbir zaman bizim
 * sunucumuza gelmez (PCI-DSS kapsamı dışında kalırız). Sonuç yalnızca
 * iyzico'dan sunucu-sunucu sorgulanan, imzası doğrulanan yanıta göre işlenir;
 * tarayıcıdan gelen hiçbir "başarılı" bilgisine güvenilmez.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly callbackUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly iyzico: IyzicoClient,
    private readonly orders: OrdersService,
    private readonly mails: OrderMailService,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    this.callbackUrl = `${(config.get('API_PUBLIC_URL', { infer: true }) ?? '').replace(/\/$/, '')}/payments/iyzico/callback`;
  }

  get enabled() {
    return this.iyzico.enabled;
  }

  /** Ödeme sayfasını başlatır; müşteri dönen adrese yönlendirilir */
  async init(orderNumber: string, owner: PaymentOwner, ip: string | undefined) {
    const where = 'userId' in owner ? { orderNumber, userId: owner.userId } : { orderNumber, guestAccessTokenHash: hashToken(owner.guestAccessToken) };
    const order = await this.prisma.order.findFirst({
      where,
      include: { items: { orderBy: { id: 'asc' }, include: { product: { select: { category: { select: { name: true } } } } } }, user: { select: { createdAt: true } }, payment: true },
    });
    if (!order) throw new NotFoundException('Sipariş bulunamadı.');
    if (order.status !== 'PENDING') throw new ConflictException(order.status === 'CANCELLED' ? 'Bu sipariş iptal edilmiş; lütfen yeniden sipariş verin.' : 'Bu siparişin ödemesi zaten alınmış.');
    if (order.paymentDueAt && order.paymentDueAt < new Date()) throw new ConflictException('Ödeme süresi doldu; lütfen yeniden sipariş verin.');

    const total = toKurus(order.total);
    const basketItems = buildBasket(
      order.items.map((i) => ({
        id: i.variantId,
        name: `${i.productName}${i.variantName ? ` (${i.variantName})` : ''}`,
        category: i.product.category.name,
        lineTotal: toKurus(i.price) * i.quantity,
      })),
      total,
      toKurus(order.shippingFee),
    );

    const ship = order.shippingAddress as Address;
    const bill = order.billingInfo as Billing;
    const { name, surname } = splitName(bill.type === 'INDIVIDUAL' && bill.fullName ? bill.fullName : (ship.fullName ?? ''));
    const conversationId = order.payment?.conversationId ?? randomUUID();
    const price = fromKurus(total);
    const address = (a: Address, contact: string) => ({
      contactName: contact.slice(0, 100),
      city: a.city ?? '-',
      country: 'Turkey',
      address: [a.addressLine, a.district, a.city].filter(Boolean).join(', ').slice(0, 500) || '-',
      ...(a.zipCode ? { zipCode: a.zipCode } : {}),
    });

    const response = await this.iyzico.post(INIT_PATH, {
      locale: 'tr',
      conversationId,
      price,
      paidPrice: price,
      currency: 'TRY',
      basketId: order.id,
      paymentGroup: 'PRODUCT',
      callbackUrl: this.callbackUrl,
      enabledInstallments: [1, 2, 3, 6, 9, 12],
      buyer: {
        id: order.userId ?? `misafir-${order.id}`,
        name,
        surname,
        gsmNumber: order.phone,
        email: order.email,
        // Bireysel faturada TCKN girildiyse o; aksi halde iyzico'nun kabul ettiği varsayılan
        identityNumber: bill.type === 'INDIVIDUAL' && bill.identityNumber ? bill.identityNumber : '11111111111',
        registrationAddress: address(ship, ship.fullName ?? '').address,
        city: ship.city ?? '-',
        country: 'Turkey',
        ip: ip ?? '127.0.0.1',
        ...(order.user ? { registrationDate: iyziDate(order.user.createdAt) } : {}),
      },
      shippingAddress: address(ship, ship.fullName ?? `${name} ${surname}`),
      billingAddress: address(bill, bill.type === 'CORPORATE' ? (bill.companyName ?? '') : (bill.fullName ?? ship.fullName ?? '')),
      basketItems,
    });

    if (response.status !== 'success' || typeof response.token !== 'string' || typeof response.paymentPageUrl !== 'string') {
      throw new BadRequestException(friendlyError(response));
    }
    if (!this.iyzico.verifySignature([conversationId, response.token], response.signature)) {
      this.logger.error(`iyzico başlatma yanıtının imzası geçersiz (sipariş ${order.orderNumber})`);
      throw new BadRequestException('Ödeme başlatılamadı. Lütfen tekrar deneyin.');
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.payment.upsert({
        where: { orderId: order.id },
        create: { orderId: order.id, provider: 'iyzico', amount: price, conversationId, tokenHash: hashToken(response.token), initiatedAt: now },
        update: { amount: price, tokenHash: hashToken(response.token), initiatedAt: now, status: 'PENDING', errorMessage: null },
      }),
      // Ödeme sayfası açıkken sipariş zaman aşımına düşmesin
      this.prisma.order.updateMany({
        where: { id: order.id, status: 'PENDING' },
        data: {
          paymentDueAt: new Date(Math.min(Math.max(order.paymentDueAt?.getTime() ?? 0, now.getTime() + PAYMENT_WINDOW_MS), order.createdAt.getTime() + MAX_HOLD_MS)),
        },
      }),
    ]);
    return { paymentPageUrl: response.paymentPageUrl };
  }

  /**
   * iyzico'nun tarayıcı üzerinden POST ettiği token ile sonucu sunucu-sunucu sorgular.
   * Aynı token iki kez gelirse (yenileme, çift tık) ikinci işlem hiçbir şey değiştirmez.
   */
  async complete(token: string): Promise<PaymentResult | null> {
    const response = await this.iyzico.post(RETRIEVE_PATH, { locale: 'tr', token });
    const payment = typeof response.conversationId === 'string' ? await this.prisma.payment.findUnique({ where: { conversationId: response.conversationId }, include: { order: true } }) : null;
    if (!payment) {
      this.logger.warn('iyzico geri dönüşü bilinen bir ödemeyle eşleşmedi');
      return null;
    }
    const { order } = payment;
    const fail = async (reason: string, log = true) => {
      if (log) this.logger.warn(`Ödeme başarısız (sipariş ${order.orderNumber}): ${reason}`);
      await this.prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'FAILED', errorMessage: reason.slice(0, 500) } });
      return { orderNumber: order.orderNumber, ok: false, reason };
    };

    if (response.status !== 'success') return fail(friendlyError(response), false);

    const signed = this.iyzico.verifySignature(
      [response.paymentStatus, response.paymentId, response.currency, response.basketId, response.conversationId, response.paidPrice, response.price, response.token],
      response.signature,
    );
    if (!signed) return fail('Ödeme yanıtının imzası doğrulanamadı');
    if (response.paymentStatus !== 'SUCCESS') return fail('Ödeme onaylanmadı. Kart bilgilerinizi kontrol edip tekrar deneyin.', false);
    if (response.basketId !== order.id || response.currency !== 'TRY') return fail('Ödeme siparişle eşleşmedi');
    if (toKurus(String(response.price)) !== toKurus(order.total) || toKurus(String(response.paidPrice)) < toKurus(order.total)) {
      return fail('Ödenen tutar sipariş tutarıyla uyuşmuyor');
    }
    const paymentId = String(response.paymentId);
    if (payment.status === 'SUCCEEDED') return { orderNumber: order.orderNumber, ok: payment.providerPaymentId === paymentId };

    const summary = {
      paymentId,
      paidPrice: String(response.paidPrice),
      installment: Number(response.installment ?? 1),
      cardAssociation: str(response.cardAssociation),
      cardFamily: str(response.cardFamily),
      lastFourDigits: str(response.lastFourDigits),
      fraudStatus: Number(response.fraudStatus ?? 0),
      // İade için gerekli: iyzico iadeyi sepet kalemi bazında (paymentTransactionId) yapar
      items: (Array.isArray(response.itemTransactions) ? (response.itemTransactions as Record<string, unknown>[]) : []).map((t) => ({
        itemId: String(t.itemId),
        paymentTransactionId: String(t.paymentTransactionId),
        price: String(t.price),
      })),
    };

    const now = new Date();
    const outcome = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: ['PENDING', 'FAILED'] } },
        data: { status: 'SUCCEEDED', providerPaymentId: paymentId, providerRawResponse: summary, paidAt: now, errorMessage: null },
      });
      if (claimed.count === 0) return 'duplicate' as const;

      const fromPending = await tx.order.updateMany({ where: { id: order.id, status: 'PENDING' }, data: { status: 'PAID', paidAt: now, paymentDueAt: null } });
      if (fromPending.count === 1) {
        await tx.orderEvent.create({ data: { orderId: order.id, status: 'PAID', note: `iyzico ödemesi (${summary.installment} taksit)` } });
        await this.orders.clearSourceCart(tx, order.sourceCartId);
        return 'paid' as const;
      }
      // Ödeme sırasında süre dolup iptal edildiyse: stok hâlâ varsa sipariş canlandırılır
      const current = await tx.order.findUnique({ where: { id: order.id }, select: { status: true } });
      if (current?.status === 'CANCELLED' && (await this.orders.revive(tx, order.id))) {
        await tx.order.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: now, paymentDueAt: null, cancelledAt: null, cancelReason: null } });
        await tx.orderEvent.create({ data: { orderId: order.id, status: 'PAID', note: 'Süre dolduktan sonra ödeme alındı; stok yeniden ayrıldı.' } });
        await this.orders.clearSourceCart(tx, order.sourceCartId);
        return 'paid' as const;
      }
      return 'needsRefund' as const;
    });

    if (outcome === 'paid') {
      await this.mails.paid(order.id).catch(() => undefined);
      return { orderNumber: order.orderNumber, ok: true };
    }
    if (outcome === 'needsRefund') {
      // Para çekildi ama sipariş karşılanamıyor: yönetici iyzico panelinden iade etmeli
      await this.audit.log({ action: 'payment.needs_refund', entity: 'Order', entityId: order.id, metaData: { paymentId, paidPrice: summary.paidPrice } });
      await this.mails
        .alertAdmin(
          `İADE GEREKLİ: ${order.orderNumber}`,
          `İptal edilmiş ${order.orderNumber} numaralı siparişe ödeme geldi (iyzico ödeme no: ${paymentId}, ${summary.paidPrice} ₺) ve stok yetersiz olduğu için sipariş canlandırılamadı.\nLütfen iyzico panelinden iadeyi yapın ve müşteriye bilgi verin.`,
        )
        .catch(() => undefined);
      return { orderNumber: order.orderNumber, ok: false, reason: 'Siparişiniz zaman aşımına uğradı. Ödemeniz iade edilecektir.' };
    }
    const fresh = await this.prisma.payment.findUnique({ where: { id: payment.id }, select: { providerPaymentId: true } });
    return { orderNumber: order.orderNumber, ok: fresh?.providerPaymentId === paymentId };
  }
}

/** iyzico tarih biçimi: "2026-11-09 14:05:00" */
function iyziDate(d: Date) {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, 50) : null);

/** iyzico hata mesajı müşteriye gösterilebilir; teknik ayrıntı ve uzunluk sınırlanır */
function friendlyError(r: IyzicoResponse) {
  const msg = typeof r.errorMessage === 'string' ? r.errorMessage.slice(0, 200) : '';
  return msg || 'Ödeme şu anda başlatılamadı. Lütfen tekrar deneyin.';
}
