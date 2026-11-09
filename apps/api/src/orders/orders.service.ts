import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { fromKurus, toKurus } from '../commerce/money.js';
import type { OrderStatus, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

/**
 * İzin verilen durum geçişleri. Ödeme entegrasyonu gelene kadar PENDING→PAID
 * yalnızca admin tarafından (ör. havale/EFT) yapılır.
 */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Ödeme bekleniyor',
  PAID: 'Ödeme alındı',
  PROCESSING: 'Hazırlanıyor',
  SHIPPED: 'Kargoya verildi',
  DELIVERED: 'Teslim edildi',
  CANCELLED: 'İptal edildi',
  REFUNDED: 'İade edildi',
};

const money = (v: { toFixed(d: number): string }) => fromKurus(toKurus(v));

/** TCKN/VKN müşteriye maskeli gösterilir (ekran görüntüsü vb. sızıntılara karşı) */
function maskBilling(billing: Prisma.JsonValue) {
  const b = (billing ?? {}) as Record<string, unknown>;
  const mask = (v: unknown) => (typeof v === 'string' && v.length > 4 ? `${'•'.repeat(v.length - 4)}${v.slice(-4)}` : v);
  return { ...b, identityNumber: mask(b.identityNumber), taxNumber: mask(b.taxNumber) };
}

const DETAIL_INCLUDE = {
  items: { orderBy: { id: 'asc' as const } },
  events: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ───────────── Görünümler ─────────────

  customerView(order: Prisma.OrderGetPayload<{ include: typeof DETAIL_INCLUDE }>) {
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      statusLabel: STATUS_LABEL[order.status],
      createdAt: order.createdAt,
      paymentDueAt: order.status === 'PENDING' ? order.paymentDueAt : null,
      email: order.email,
      phone: order.phone,
      shippingAddress: order.shippingAddress,
      billingInfo: maskBilling(order.billingInfo),
      items: order.items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        variantName: i.variantName,
        quantity: i.quantity,
        unitPrice: money(i.price),
        lineTotal: fromKurus(toKurus(i.price) * i.quantity),
      })),
      subtotal: money(order.subtotal),
      discount: money(order.discount),
      shippingFee: money(order.shippingFee),
      vatTotal: money(order.vatTotal),
      total: money(order.total),
      couponCode: order.couponCode,
      shippingCarrier: order.shippingCarrier,
      trackingNumber: order.trackingNumber,
      canCancel: order.status === 'PENDING',
      timeline: order.events.map((e) => ({ status: e.status, label: STATUS_LABEL[e.status], note: e.note, at: e.createdAt })),
    };
  }

  async listForUser(userId: string, page = 1) {
    const where = { userId };
    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 20,
        take: 20,
        select: { orderNumber: true, status: true, total: true, createdAt: true, _count: { select: { items: true } } },
      }),
    ]);
    return {
      items: orders.map((o) => ({ orderNumber: o.orderNumber, status: o.status, statusLabel: STATUS_LABEL[o.status], total: money(o.total), itemCount: o._count.items, createdAt: o.createdAt })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / 20)),
    };
  }

  async getForUser(userId: string, orderNumber: string) {
    const order = await this.prisma.order.findFirst({ where: { orderNumber, userId }, include: DETAIL_INCLUDE });
    if (!order) throw new NotFoundException('Sipariş bulunamadı.');
    return this.customerView(order);
  }

  /** Misafir: sipariş no + erişim anahtarı (ikisi birden eşleşmeli) */
  async getForGuest(orderNumber: string, accessTokenHash: string) {
    const order = await this.prisma.order.findFirst({ where: { orderNumber, guestAccessTokenHash: accessTokenHash }, include: DETAIL_INCLUDE });
    if (!order) throw new NotFoundException('Sipariş bulunamadı.');
    return this.customerView(order);
  }

  // ───────────── Durum değişiklikleri ─────────────

  /**
   * İptal: stok geri eklenir, kupon kullanımı geri alınır. Aynı sipariş iki
   * kez iptal edilemez (koşullu güncelleme → yarış durumunda stok iki kez eklenmez).
   */
  async cancel(orderId: string, reason: string, actorId: string | null, allowedFrom: OrderStatus[] = ['PENDING', 'PAID', 'PROCESSING']) {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: { in: allowedFrom } },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason.slice(0, 500) },
      });
      if (count === 0) throw new ConflictException('Sipariş bu durumda iptal edilemez.');
      await this.restock(tx, orderId);
      await tx.orderEvent.create({ data: { orderId, status: 'CANCELLED', note: reason.slice(0, 500), actorId } });
    });
  }

  async transition(
    orderId: string,
    to: OrderStatus,
    actorId: string,
    extra: { note?: string; shippingCarrier?: string; trackingNumber?: string },
    ipAddress?: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { status: true, sourceCartId: true } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı.');
    if (!TRANSITIONS[order.status].includes(to)) {
      throw new BadRequestException(`"${STATUS_LABEL[order.status]}" durumundaki sipariş "${STATUS_LABEL[to]}" yapılamaz.`);
    }

    if (to === 'CANCELLED') {
      await this.cancel(orderId, extra.note?.trim() || 'Yönetici tarafından iptal edildi.', actorId, [order.status]);
    } else {
      if (to === 'SHIPPED' && (!extra.shippingCarrier || !extra.trackingNumber)) {
        throw new BadRequestException('Kargoya verirken kargo firması ve takip numarası zorunludur.');
      }
      const now = new Date();
      await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.order.updateMany({
          where: { id: orderId, status: order.status },
          data: {
            status: to,
            ...(to === 'PAID' ? { paidAt: now, paymentDueAt: null } : {}),
            ...(to === 'SHIPPED' ? { shippedAt: now, shippingCarrier: extra.shippingCarrier, trackingNumber: extra.trackingNumber } : {}),
            ...(to === 'DELIVERED' ? { deliveredAt: now } : {}),
          },
        });
        if (count === 0) throw new ConflictException('Sipariş bu sırada değişti; sayfayı yenileyin.');
        await tx.orderEvent.create({ data: { orderId, status: to, note: extra.note?.trim().slice(0, 500) || null, actorId } });
        // Ödeme alındı: siparişin geldiği sepet boşaltılır
        if (to === 'PAID' && order.sourceCartId) {
          await tx.cartItem.deleteMany({ where: { cartId: order.sourceCartId } });
          await tx.cart.updateMany({ where: { id: order.sourceCartId }, data: { couponCode: null } });
        }
      });
    }
    await this.audit.log({
      action: 'admin.order_status',
      entity: 'Order',
      entityId: orderId,
      userId: actorId,
      ipAddress,
      metaData: { from: order.status, to },
    });
  }

  /** Ödeme süresi dolan siparişler (zamanlanmış iş çağırır) */
  async expireUnpaid(now = new Date()) {
    const due = await this.prisma.order.findMany({
      where: { status: 'PENDING', paymentDueAt: { lt: now } },
      select: { id: true },
      take: 200,
    });
    let cancelled = 0;
    for (const { id } of due) {
      try {
        await this.cancel(id, 'Ödeme süresi doldu.', null, ['PENDING']);
        cancelled++;
      } catch {
        // Bu arada ödendi veya iptal edildi: sorun değil
      }
    }
    if (cancelled) this.logger.log(`${cancelled} ödenmemiş sipariş iptal edildi, stoklar geri eklendi.`);
    return cancelled;
  }

  private async restock(tx: Tx, orderId: string) {
    const items = await tx.orderItem.findMany({ where: { orderId }, select: { variantId: true, quantity: true, variant: { select: { trackStock: true } } } });
    for (const item of items) {
      if (item.variant.trackStock) {
        await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
      }
    }
    const redemption = await tx.couponRedemption.findUnique({ where: { orderId }, select: { id: true, couponId: true } });
    if (redemption) {
      await tx.couponRedemption.delete({ where: { id: redemption.id } });
      await tx.coupon.updateMany({ where: { id: redemption.couponId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
    }
  }
}

export { DETAIL_INCLUDE };
