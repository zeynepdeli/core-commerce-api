import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { hashToken, newSecureToken } from '../auth/secure-token.js';
import { CartService, type CartOwner, SELLABLE_VARIANT } from '../cart/cart.service.js';
import { fromKurus, toKurus } from '../commerce/money.js';
import { quote } from '../commerce/pricing.js';
import { toPricingCoupon } from '../coupons/coupons.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { LegalService, type Placeholder, renderTemplate, sha256 } from '../legal/legal.service.js';
import { newOrderNumber } from '../orders/order-number.js';
import { DETAIL_INCLUDE, OrdersService } from '../orders/orders.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StoreSettingsService } from '../store-settings/store-settings.service.js';

import type { BillingDto, CheckoutAddressDto, CheckoutDto, CheckoutPreviewDto } from './checkout.dto.js';

type Buyer = { userId: string | null; email: string; name: string };
type Address = { fullName: string; phone: string; city: string; district: string; addressLine: string; zipCode: string | null };

const tl = (kurus: number) => `${fromKurus(kurus).replace('.', ',')} ₺`;
const addressText = (a: Address | null) => (a ? `${a.fullName}, ${a.addressLine}, ${a.district}/${a.city}${a.zipCode ? ` ${a.zipCode}` : ''} · ${a.phone}` : '');

export type ClientMeta = { ipAddress?: string; userAgent?: string };

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly settings: StoreSettingsService,
    private readonly legal: LegalService,
    private readonly orders: OrdersService,
  ) {}

  /** Siparişten önce: güncel tutar ve doldurulmuş yasal metinler */
  async preview(owner: CartOwner, buyer: Buyer | null, dto: CheckoutPreviewDto) {
    const cart = await this.cart.findForCheckout(owner);
    const view = await this.cart.render(cart);
    const shipping = dto.shippingAddressId && buyer?.userId ? await this.ownAddress(buyer.userId, dto.shippingAddressId) : this.toAddress(dto.shippingAddress);
    const documents = await this.renderDocuments({
      buyerName: shipping?.fullName ?? buyer?.name ?? '',
      email: dto.email ?? buyer?.email ?? '',
      phone: shipping?.phone ?? '',
      shipping,
      billing: dto.billing ? this.billingInfo(dto.billing, shipping) : null,
      lines: await this.withReturnable(view.items.filter((i) => i.available).map((i) => ({ productId: i.productId, name: i.productName, variant: i.variantName, quantity: i.quantity, lineTotal: toKurus(i.lineTotal) }))),
      totals: {
        subtotal: toKurus(view.summary.subtotal),
        discount: toKurus(view.summary.discount),
        shipping: toKurus(view.summary.shipping),
        total: toKurus(view.summary.total),
        vat: toKurus(view.summary.vat),
      },
      date: new Date(),
    });
    return { cart: view, documents: documents.map(({ type, title, content }) => ({ type, title, content })) };
  }

  /**
   * Siparişi oluşturur. Tek veritabanı işleminde:
   * fiyat/stok yeniden okunur → stok koşullu düşülür (aynı anda son ürünü iki kişi alamaz)
   * → tutar sunucuda hesaplanır → kupon kullanımı ayrılır → sipariş, adres/fatura kopyası,
   * onaylanan sözleşmelerin doldurulmuş hali ve izinler kaydedilir.
   */
  async create(owner: CartOwner, buyer: Buyer | null, dto: CheckoutDto, meta: ClientMeta) {
    const email = buyer?.email ?? dto.email;
    if (!email) throw new BadRequestException('E-posta adresi zorunludur.');

    // Aynı istek tekrar geldiyse aynı siparişi döndür
    const existing = await this.prisma.order.findUnique({ where: { idempotencyKey: dto.idempotencyKey }, include: DETAIL_INCLUDE });
    if (existing) {
      if (existing.email !== email) throw new ConflictException('Bu istek zaten kullanıldı.');
      return { order: this.orders.customerView(existing), accessToken: null };
    }

    const cart = await this.cart.findForCheckout(owner);
    if (!cart || cart.items.length === 0) throw new BadRequestException('Sepetiniz boş.');

    const shipping = dto.shippingAddressId
      ? buyer?.userId
        ? await this.ownAddress(buyer.userId, dto.shippingAddressId)
        : null
      : this.toAddress(dto.shippingAddress);
    if (!shipping) throw new BadRequestException('Teslimat adresi gerekli.');
    const billing = this.billingInfo(dto.billing, shipping);

    const settings = await this.settings.pricing();
    const seller = await this.settings.seller();
    const couponRow = cart.couponCode ? await this.prisma.coupon.findUnique({ where: { code: cart.couponCode } }) : null;
    if (cart.couponCode && !couponRow) throw new ConflictException('Sepetteki kupon artık geçerli değil; kaldırıp tekrar deneyin.');

    const guestAccess = buyer?.userId ? null : newSecureToken();
    const now = new Date();

    // Bu sepetten daha önce oluşturulmuş ÖDENMEMİŞ sipariş varsa önce iptal edilir:
    // stoğu ve kupon hakkı yeni siparişe serbest kalır (stok boşuna kilitli kalmaz)
    const previous = await this.prisma.order.findMany({ where: { sourceCartId: cart.id, status: 'PENDING' }, select: { id: true } });
    for (const { id } of previous) {
      await this.orders.cancel(id, 'Aynı sepetten yeni sipariş oluşturuldu.', null, ['PENDING']).catch(() => undefined);
    }

    const orderId = await this.prisma.$transaction(
      async (tx) => {
        const lines = [];
        for (const item of cart.items) {
          const v = await tx.productVariant.findFirst({
            where: { id: item.variantId, ...SELLABLE_VARIANT },
            select: { id: true, name: true, sku: true, price: true, trackStock: true, product: { select: { id: true, name: true, vatRate: true, isReturnable: true } } },
          });
          if (!v) throw new ConflictException(`"${item.variant.product.name}" artık satışta değil; sepetinizi kontrol edin.`);
          if (v.trackStock) {
            const { count } = await tx.productVariant.updateMany({
              where: { id: v.id, stock: { gte: item.quantity } },
              data: { stock: { decrement: item.quantity } },
            });
            if (count === 0) throw new ConflictException(`"${v.product.name} ${v.name}" için yeterli stok kalmadı; sepetinizi kontrol edin.`);
          }
          lines.push({ variant: v, quantity: item.quantity, unitPrice: toKurus(v.price) });
        }

        const q = quote(
          lines.map((l) => ({ variantId: l.variant.id, quantity: l.quantity, unitPrice: l.unitPrice, vatRate: l.variant.product.vatRate })),
          settings,
          couponRow ? toPricingCoupon(couponRow) : null,
          now,
        );
        if (q.couponError) throw new ConflictException(`Kupon uygulanamadı: ${q.couponError} Kuponu kaldırıp tekrar deneyin.`);
        if (q.belowMinimum !== null) throw new BadRequestException(`En düşük sipariş tutarına ${tl(q.belowMinimum)} kaldı.`);

        if (couponRow) {
          if (couponRow.perUserLimit !== null) {
            const used = await tx.couponRedemption.count({
              where: { couponId: couponRow.id, ...(buyer?.userId ? { OR: [{ userId: buyer.userId }, { email }] } : { email }) },
            });
            if (used >= couponRow.perUserLimit) throw new ConflictException('Bu kuponu kullanım hakkınız doldu.');
          }
          // Toplam sınır koşullu artırılır (aynı anda iki sipariş sınırı aşamaz)
          const { count } = await tx.coupon.updateMany({
            where: { id: couponRow.id, ...(couponRow.usageLimit !== null ? { usedCount: { lt: couponRow.usageLimit } } : {}) },
            data: { usedCount: { increment: 1 } },
          });
          if (count === 0) throw new ConflictException('Bu kuponun kullanım hakkı doldu.');
        }

        let orderNumber = newOrderNumber(now);
        while (await tx.order.findUnique({ where: { orderNumber }, select: { id: true } })) orderNumber = newOrderNumber(now);

        const documents = await this.renderDocuments({
          buyerName: shipping.fullName,
          email,
          phone: shipping.phone,
          shipping,
          billing,
          lines: lines.map((l) => ({
            name: l.variant.product.name,
            variant: l.variant.name,
            quantity: l.quantity,
            lineTotal: l.unitPrice * l.quantity,
            returnable: l.variant.product.isReturnable,
          })),
          totals: { subtotal: q.subtotal, discount: q.discount, shipping: q.shipping, total: q.total, vat: q.vat },
          date: now,
          orderNumber,
        });

        const order = await tx.order.create({
          data: {
            orderNumber,
            userId: buyer?.userId ?? null,
            addressId: dto.shippingAddressId && buyer?.userId ? dto.shippingAddressId : null,
            email,
            phone: shipping.phone,
            shippingAddress: shipping,
            billingInfo: billing,
            subtotal: fromKurus(q.subtotal),
            discount: fromKurus(q.discount),
            shippingFee: fromKurus(q.shipping),
            vatTotal: fromKurus(q.vat),
            total: fromKurus(q.total),
            couponCode: couponRow?.code ?? null,
            customerNote: dto.note?.trim() || null,
            idempotencyKey: dto.idempotencyKey,
            guestAccessTokenHash: guestAccess?.hash ?? null,
            paymentDueAt: new Date(now.getTime() + seller.paymentTimeoutMinutes * 60_000),
            sourceCartId: cart.id,
            items: {
              create: lines.map((l) => ({
                productId: l.variant.product.id,
                variantId: l.variant.id,
                productName: l.variant.product.name,
                variantName: l.variant.name,
                productSku: l.variant.sku,
                vatRate: l.variant.product.vatRate,
                returnable: l.variant.product.isReturnable,
                quantity: l.quantity,
                price: fromKurus(l.unitPrice),
              })),
            },
            events: { create: { status: 'PENDING', note: 'Sipariş oluşturuldu, ödeme bekleniyor.' } },
            agreements: {
              create: documents
                .filter((d) => d.type !== 'KVKK_NOTICE')
                .map((d) => ({
                  type: d.type,
                  version: d.version,
                  content: d.content,
                  contentHash: sha256(d.content),
                  ipAddress: meta.ipAddress,
                  userAgent: meta.userAgent,
                })),
            },
            ...(couponRow ? { redemption: { create: { couponId: couponRow.id, userId: buyer?.userId ?? null, email } } } : {}),
          },
          select: { id: true },
        });

        const consents: Prisma.ConsentRecordCreateManyInput[] = [];
        if (dto.marketingEmail !== undefined) consents.push({ userId: buyer?.userId ?? null, email, channel: 'EMAIL', granted: dto.marketingEmail, source: 'checkout', ipAddress: meta.ipAddress });
        if (dto.marketingSms !== undefined) consents.push({ userId: buyer?.userId ?? null, email, phone: shipping.phone, channel: 'SMS', granted: dto.marketingSms, source: 'checkout', ipAddress: meta.ipAddress });
        if (consents.length) await tx.consentRecord.createMany({ data: consents });

        return order.id;
      },
      { timeout: 15_000 },
    );

    const created = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: DETAIL_INCLUDE });
    // Misafir erişim anahtarı yalnızca bu yanıtta bir kez döner
    return { order: this.orders.customerView(created), accessToken: guestAccess?.token ?? null };
  }

  // ───────────── Yardımcılar ─────────────

  private async ownAddress(userId: string, id: string): Promise<Address> {
    const a = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!a) throw new NotFoundException('Adres bulunamadı.');
    return { fullName: a.fullName, phone: a.phone, city: a.city, district: a.district, addressLine: a.addressLine, zipCode: a.zipCode };
  }

  private toAddress(dto?: CheckoutAddressDto): Address | null {
    if (!dto) return null;
    return { fullName: dto.fullName, phone: dto.phone, city: dto.city, district: dto.district, addressLine: dto.addressLine, zipCode: dto.zipCode || null };
  }

  private billingInfo(dto: BillingDto, shipping: Address | null) {
    const address = dto.sameAsShipping ? shipping : this.toAddress(dto.address);
    return {
      type: dto.type,
      fullName: dto.type === 'INDIVIDUAL' ? (dto.fullName ?? shipping?.fullName ?? '') : (dto.fullName ?? null),
      identityNumber: dto.type === 'INDIVIDUAL' ? dto.identityNumber || null : null,
      companyName: dto.type === 'CORPORATE' ? (dto.companyName ?? null) : null,
      taxOffice: dto.type === 'CORPORATE' ? (dto.taxOffice ?? null) : null,
      taxNumber: dto.type === 'CORPORATE' ? (dto.taxNumber ?? null) : null,
      city: address?.city ?? null,
      district: address?.district ?? null,
      addressLine: address?.addressLine ?? null,
    };
  }

  private async withReturnable<T extends { productId: string }>(lines: T[]) {
    const rows = await this.prisma.product.findMany({ where: { id: { in: lines.map((l) => l.productId) } }, select: { id: true, isReturnable: true } });
    const map = new Map(rows.map((r) => [r.id, r.isReturnable]));
    return lines.map((l) => ({ ...l, returnable: map.get(l.productId) ?? true }));
  }

  private async renderDocuments(data: {
    buyerName: string;
    email: string;
    phone: string;
    shipping: Address | null;
    billing: ReturnType<CheckoutService['billingInfo']> | null;
    lines: { name: string; variant: string | null; quantity: number; lineTotal: number; returnable: boolean }[];
    totals: { subtotal: number; discount: number; shipping: number; total: number; vat: number };
    date: Date;
    orderNumber?: string;
  }) {
    const [docs, s] = await Promise.all([this.legal.all(), this.settings.seller()]);
    const b = data.billing;
    const values: Record<Placeholder, string> = {
      SATICI_UNVAN: s.sellerName ?? '',
      SATICI_ADRES: s.sellerAddress ?? '',
      SATICI_TELEFON: s.sellerPhone ?? '',
      SATICI_EPOSTA: s.sellerEmail ?? '',
      SATICI_VERGI_DAIRESI: s.sellerTaxOffice ?? '',
      SATICI_VERGI_NO: s.sellerTaxNumber ?? '',
      SATICI_MERSIS: s.sellerMersisNo ?? '',
      ALICI_AD: data.buyerName,
      ALICI_EPOSTA: data.email,
      ALICI_TELEFON: data.phone,
      TESLIMAT_ADRESI: addressText(data.shipping),
      FATURA_BILGILERI: b
        ? b.type === 'CORPORATE'
          ? `${b.companyName} · ${b.taxOffice} V.D. ${b.taxNumber} · ${b.addressLine ?? ''} ${b.district ?? ''}/${b.city ?? ''}`
          : `${b.fullName}${b.identityNumber ? ` · TCKN ${b.identityNumber}` : ''} · ${b.addressLine ?? ''} ${b.district ?? ''}/${b.city ?? ''}`
        : '',
      URUNLER: data.lines
        .map((l) => `- ${l.name}${l.variant ? ` (${l.variant})` : ''} × ${l.quantity} = ${tl(l.lineTotal)}${l.returnable ? '' : ' — cayma hakkı kullanılamaz (yönetmelik md. 15)'}`)
        .join('\n'),
      CAYMA_SURESI: String(s.returnWindowDays),
      ARA_TOPLAM: tl(data.totals.subtotal),
      INDIRIM: tl(data.totals.discount),
      KARGO: tl(data.totals.shipping),
      TOPLAM: tl(data.totals.total),
      KDV: tl(data.totals.vat),
      TARIH: `${new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(data.date)}${data.orderNumber ? ` · Sipariş No: ${data.orderNumber}` : ''}`,
    };
    return docs.map((d) => ({ type: d.type, title: d.title, version: d.version, content: renderTemplate(d.content, values) }));
  }
}

export { hashToken };
