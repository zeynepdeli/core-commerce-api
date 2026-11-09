import { Injectable, NotFoundException } from '@nestjs/common';

import { fromKurus, toKurus } from '../commerce/money.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

import type { AdminOrdersQueryDto } from './orders.dto.js';
import { STATUS_LABEL, TRANSITIONS } from './orders.service.js';

const money = (v: { toFixed(d: number): string }) => fromKurus(toKurus(v));
const PAGE = 25;

@Injectable()
export class AdminOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminOrdersQueryDto) {
    const page = query.page ?? 1;
    const q = query.q;
    const where: Prisma.OrderWhereInput = {
      AND: [
        q
          ? {
              OR: [
                { orderNumber: { contains: q.toUpperCase() } },
                { email: { contains: q.toLowerCase() } },
                { shippingAddress: { path: ['fullName'], string_contains: q } },
              ],
            }
          : {},
        query.status ? { status: query.status } : {},
        query.from || query.to ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {},
      ],
    };
    const [total, orders, counts] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE,
        take: PAGE,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          email: true,
          shippingAddress: true,
          total: true,
          userId: true,
          createdAt: true,
          paymentDueAt: true,
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.groupBy({ by: ['status'], orderBy: { status: 'asc' }, _count: { _all: true } }),
    ]);
    return {
      items: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        statusLabel: STATUS_LABEL[o.status],
        customerName: (o.shippingAddress as { fullName?: string }).fullName ?? '',
        email: o.email,
        guest: o.userId === null,
        total: money(o.total),
        itemCount: o._count.items,
        createdAt: o.createdAt,
        paymentDueAt: o.status === 'PENDING' ? o.paymentDueAt : null,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE)),
      // Durum filtresi rozetleri için
      statusCounts: Object.fromEntries(counts.map((c) => [c.status, (c._count as { _all: number })._all])),
    };
  }

  async get(id: string) {
    const o = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { orderBy: { id: 'asc' } },
        events: { orderBy: { createdAt: 'asc' } },
        agreements: { select: { type: true, version: true, contentHash: true, acceptedAt: true, ipAddress: true, content: true } },
        user: { select: { id: true, name: true, email: true } },
        payment: { select: { provider: true, status: true, providerPaymentId: true, providerRawResponse: true, errorMessage: true, paidAt: true, initiatedAt: true } },
      },
    });
    if (!o) throw new NotFoundException('Sipariş bulunamadı.');
    const actorIds = [...new Set(o.events.map((e) => e.actorId).filter((x): x is string => !!x))];
    const actors = actorIds.length ? await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
    const actorName = new Map(actors.map((a) => [a.id, a.name]));
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      statusLabel: STATUS_LABEL[o.status],
      nextStatuses: TRANSITIONS[o.status].map((s) => ({ status: s, label: STATUS_LABEL[s] })),
      createdAt: o.createdAt,
      paidAt: o.paidAt,
      shippedAt: o.shippedAt,
      deliveredAt: o.deliveredAt,
      cancelledAt: o.cancelledAt,
      cancelReason: o.cancelReason,
      paymentDueAt: o.status === 'PENDING' ? o.paymentDueAt : null,
      customer: o.user ?? null,
      email: o.email,
      phone: o.phone,
      shippingAddress: o.shippingAddress,
      // Fatura kesmek için tam bilgi (yalnızca admin)
      billingInfo: o.billingInfo,
      customerNote: o.customerNote,
      couponCode: o.couponCode,
      shippingCarrier: o.shippingCarrier,
      trackingNumber: o.trackingNumber,
      items: o.items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        variantName: i.variantName,
        sku: i.productSku,
        vatRate: i.vatRate,
        quantity: i.quantity,
        unitPrice: money(i.price),
        lineTotal: fromKurus(toKurus(i.price) * i.quantity),
      })),
      subtotal: money(o.subtotal),
      discount: money(o.discount),
      shippingFee: money(o.shippingFee),
      vatTotal: money(o.vatTotal),
      total: money(o.total),
      timeline: o.events.map((e) => ({
        status: e.status,
        label: STATUS_LABEL[e.status],
        note: e.note,
        at: e.createdAt,
        actor: e.actorId ? (actorName.get(e.actorId) ?? 'Yönetici') : null,
      })),
      agreements: o.agreements,
      // Kart numarası tutulmaz; yalnızca son 4 hane, taksit ve sağlayıcı ödeme no
      payment: o.payment
        ? {
            provider: o.payment.provider,
            status: o.payment.status,
            providerPaymentId: o.payment.providerPaymentId,
            summary: o.payment.providerRawResponse as { paidPrice?: string; installment?: number; cardAssociation?: string | null; lastFourDigits?: string | null } | null,
            errorMessage: o.payment.errorMessage,
            paidAt: o.payment.paidAt,
            initiatedAt: o.payment.initiatedAt,
          }
        : null,
    };
  }
}
