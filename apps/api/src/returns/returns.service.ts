import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { fromKurus, type Kurus, toKurus } from '../commerce/money.js';
import type { Prisma, ReturnReason, ReturnStatus } from '../generated/prisma/client.js';
import { RefundsService } from '../iyzico/refunds.service.js';
import { newOrderNumber } from '../orders/order-number.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { netLineTotals } from '../payments/basket.js';
import { StoreSettingsService } from '../store-settings/store-settings.service.js';

import type { AdminReturnsQueryDto, CreateReturnDto } from './returns.dto.js';
import { ReturnMailService } from './return-mail.service.js';

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  REQUESTED: 'Talep alındı',
  APPROVED: 'Onaylandı — ürünü gönderin',
  REJECTED: 'Reddedildi',
  RECEIVED: 'Ürün teslim alındı',
  REFUNDED: 'Ücret iade edildi',
  CANCELLED: 'Vazgeçildi',
};

export const RETURN_REASON_LABEL: Record<ReturnReason, string> = {
  DAMAGED: 'Hasarlı / bozuk geldi',
  WRONG_ITEM: 'Yanlış ürün gönderildi',
  NOT_AS_DESCRIBED: 'Açıklamadaki gibi değil',
  CHANGED_MIND: 'Vazgeçtim (cayma hakkı)',
  OTHER: 'Diğer',
};

/** Adet hesabında sayılan (iptal/ret edilmemiş) talepler */
const ACTIVE: ReturnStatus[] = ['REQUESTED', 'APPROVED', 'RECEIVED', 'REFUNDED'];
const PAGE = 30;
const DAY = 86_400_000;

type Tx = Prisma.TransactionClient;
export type ReturnOwner = { userId: string } | { guestAccessTokenHash: string };

const ORDER_FOR_RETURNS = {
  items: { orderBy: { id: 'asc' as const } },
  returns: { include: { items: true }, orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.OrderInclude;
type OrderWithReturns = Prisma.OrderGetPayload<{ include: typeof ORDER_FOR_RETURNS }>;

const money = (v: { toFixed(d: number): string }) => fromKurus(toKurus(v));

/**
 * Cayma hakkı (Mesafeli Sözleşmeler Yönetmeliği): teslimden itibaren en az 14 gün,
 * gerekçe göstermeden. Ücret, indirim payı düşülmüş tutar üzerinden; tüm ürünler iade
 * edilirse ilk kargo ücreti de iade edilir. İade iyzico'dan otomatik yapılır.
 */
@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: StoreSettingsService,
    private readonly refunds: RefundsService,
    private readonly mails: ReturnMailService,
    private readonly audit: AuditService,
  ) {}

  // ───────────── Hesaplar ─────────────

  /** Her sipariş kalemi için: net tutar, iade edilebilir kalan adet, talep edilmiş tutar */
  private ledger(order: OrderWithReturns) {
    const net = netLineTotals(
      order.items.map((i) => ({ lineTotal: toKurus(i.price) * i.quantity })),
      toKurus(order.total),
      toKurus(order.shippingFee),
    );
    const active = order.returns.filter((r) => ACTIVE.includes(r.status));
    return order.items.map((item, index) => {
      const claimed = active.flatMap((r) => r.items).filter((ri) => ri.orderItemId === item.id);
      const claimedQty = claimed.reduce((s, ri) => s + ri.quantity, 0);
      const claimedAmount = claimed.reduce((s, ri) => s + toKurus(ri.amount), 0);
      return { item, net: net[index], claimedQty, claimedAmount, remaining: item.returnable ? item.quantity - claimedQty : 0 };
    });
  }

  private async deadline(order: { status: string; deliveredAt: Date | null }) {
    const { returnWindowDays } = await this.settings.seller();
    // Teslim tarihi girilmemiş kargodaki sipariş: süre henüz başlamadı
    return order.deliveredAt ? new Date(order.deliveredAt.getTime() + returnWindowDays * DAY) : null;
  }

  /** Müşteri sipariş sayfası için iade bilgisi */
  async customerInfo(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: ORDER_FOR_RETURNS });
    if (!order) return null;
    const deadline = await this.deadline(order);
    const open = ['SHIPPED', 'DELIVERED'].includes(order.status) && (!deadline || deadline > new Date());
    const ledger = this.ledger(order);
    return {
      canRequest: open && ledger.some((l) => l.remaining > 0),
      deadline,
      items: ledger.map((l) => ({ orderItemId: l.item.id, returnable: l.item.returnable, returnableQuantity: open ? l.remaining : 0 })),
      requests: order.returns.map((r) => this.customerView(r, order.items)),
    };
  }

  customerView(r: OrderWithReturns['returns'][number], orderItems: OrderWithReturns['items']) {
    const name = new Map(orderItems.map((i) => [i.id, `${i.productName} (${i.variantName})`]));
    return {
      id: r.id,
      returnNumber: r.returnNumber,
      status: r.status,
      statusLabel: RETURN_STATUS_LABEL[r.status],
      reason: r.reason,
      reasonLabel: RETURN_REASON_LABEL[r.reason],
      note: r.customerNote,
      storeNote: r.adminNote,
      refundAmount: fromKurus(toKurus(r.refundAmount) + toKurus(r.refundShipping)),
      createdAt: r.createdAt,
      refundedAt: r.refundedAt,
      canCancel: r.status === 'REQUESTED',
      items: r.items.map((i) => ({ orderItemId: i.orderItemId, name: name.get(i.orderItemId) ?? '', quantity: i.quantity, amount: money(i.amount) })),
    };
  }

  // ───────────── Müşteri ─────────────

  private ownerWhere(owner: ReturnOwner, orderNumber: string): Prisma.OrderWhereInput {
    return 'userId' in owner ? { orderNumber, userId: owner.userId } : { orderNumber, guestAccessTokenHash: owner.guestAccessTokenHash };
  }

  async create(owner: ReturnOwner, orderNumber: string, dto: CreateReturnDto) {
    const ids = dto.items.map((i) => i.orderItemId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Aynı ürün iki kez seçilemez.');

    const created = await this.prisma.$transaction(async (tx) => {
      const found = await tx.order.findFirst({ where: this.ownerWhere(owner, orderNumber), select: { id: true } });
      if (!found) throw new NotFoundException('Sipariş bulunamadı.');
      // Aynı siparişe eş zamanlı iki talep adetleri aşmasın
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${found.id} FOR UPDATE`;
      const order = await tx.order.findUniqueOrThrow({ where: { id: found.id }, include: ORDER_FOR_RETURNS });

      if (!['SHIPPED', 'DELIVERED'].includes(order.status)) {
        throw new BadRequestException(
          order.status === 'PAID' || order.status === 'PROCESSING'
            ? 'Siparişiniz henüz kargoya verilmedi. Vazgeçmek için mağazayla iletişime geçin; sipariş iptal edilip ücret iade edilir.'
            : 'Bu sipariş için iade talebi oluşturulamaz.',
        );
      }
      const deadline = await this.deadline(order);
      if (deadline && deadline < new Date()) throw new BadRequestException('İade süresi doldu.');

      const ledger = this.ledger(order);
      let total: Kurus = 0;
      const rows = dto.items.map((req) => {
        const l = ledger.find((x) => x.item.id === req.orderItemId);
        if (!l) throw new BadRequestException('Seçilen ürün bu siparişe ait değil.');
        if (!l.item.returnable) throw new BadRequestException(`"${l.item.productName}" iade edilemeyen ürünlerdendir (ör. çabuk bozulan gıda).`);
        if (req.quantity > l.remaining) throw new BadRequestException(`"${l.item.productName}" için en fazla ${l.remaining} adet iade talep edilebilir.`);
        // Son adetler: kalan tutarın tamamı (yuvarlama farkı kalmasın)
        const amount = l.claimedQty + req.quantity === l.item.quantity ? l.net - l.claimedAmount : Math.floor((l.net * req.quantity) / l.item.quantity);
        total += amount;
        return { orderItemId: req.orderItemId, quantity: req.quantity, amount: fromKurus(amount) };
      });

      // Siparişteki tüm ürünler iade ediliyorsa ilk teslimat ücreti de iade edilir (md. 13)
      const allReturned = ledger.every((l) => l.claimedQty + (dto.items.find((i) => i.orderItemId === l.item.id)?.quantity ?? 0) === l.item.quantity);
      const refundShipping = allReturned ? toKurus(order.shippingFee) : 0;

      return tx.returnRequest.create({
        data: {
          returnNumber: `IA-${newOrderNumber()}`,
          orderId: order.id,
          reason: dto.reason,
          customerNote: dto.note?.trim().slice(0, 1000) || null,
          refundAmount: fromKurus(total),
          refundShipping: fromKurus(refundShipping),
          items: { create: rows },
        },
        include: { items: true },
      });
    });
    await this.mails.requested(created.id).catch(() => undefined);
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: created.orderId }, include: { items: true } });
    return this.customerView(created, order.items);
  }

  async cancelByCustomer(owner: ReturnOwner, orderNumber: string, returnId: string) {
    const order = await this.prisma.order.findFirst({ where: this.ownerWhere(owner, orderNumber), select: { id: true } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı.');
    const { count } = await this.prisma.returnRequest.updateMany({ where: { id: returnId, orderId: order.id, status: 'REQUESTED' }, data: { status: 'CANCELLED' } });
    if (count === 0) throw new ConflictException('Bu talep artık iptal edilemez.');
    return { ok: true };
  }

  // ───────────── Yönetici ─────────────

  async list(query: AdminReturnsQueryDto) {
    const page = query.page ?? 1;
    const q = query.q;
    const where: Prisma.ReturnRequestWhereInput = {
      AND: [
        query.status ? { status: query.status } : {},
        q
          ? {
              OR: [
                { returnNumber: { contains: q.toUpperCase() } },
                { order: { orderNumber: { contains: q.toUpperCase() } } },
                { order: { email: { contains: q.toLowerCase() } } },
              ],
            }
          : {},
      ],
    };
    const [total, rows, counts] = await this.prisma.$transaction([
      this.prisma.returnRequest.count({ where }),
      this.prisma.returnRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE,
        take: PAGE,
        select: {
          id: true,
          returnNumber: true,
          status: true,
          reason: true,
          refundAmount: true,
          refundShipping: true,
          createdAt: true,
          order: { select: { id: true, orderNumber: true, email: true, shippingAddress: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.returnRequest.groupBy({ by: ['status'], orderBy: { status: 'asc' }, _count: { _all: true } }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        returnNumber: r.returnNumber,
        status: r.status,
        statusLabel: RETURN_STATUS_LABEL[r.status],
        reasonLabel: RETURN_REASON_LABEL[r.reason],
        refundTotal: fromKurus(toKurus(r.refundAmount) + toKurus(r.refundShipping)),
        itemCount: r._count.items,
        createdAt: r.createdAt,
        order: { id: r.order.id, orderNumber: r.order.orderNumber, email: r.order.email, name: (r.order.shippingAddress as { fullName?: string }).fullName ?? '' },
      })),
      counts: Object.fromEntries(counts.map((c) => [c.status, (c._count as { _all: number })._all])),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE)),
    };
  }

  async get(id: string) {
    const r = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: { items: { include: { orderItem: true } }, order: { select: { id: true, orderNumber: true, email: true, phone: true, shippingAddress: true, status: true, deliveredAt: true } } },
    });
    if (!r) throw new NotFoundException('İade talebi bulunamadı.');
    const auto = await this.refunds.autoRefundable(r.orderId);
    const payment = await this.prisma.payment.findUnique({ where: { orderId: r.orderId }, select: { provider: true, status: true } });
    return {
      id: r.id,
      returnNumber: r.returnNumber,
      status: r.status,
      statusLabel: RETURN_STATUS_LABEL[r.status],
      reason: r.reason,
      reasonLabel: RETURN_REASON_LABEL[r.reason],
      customerNote: r.customerNote,
      adminNote: r.adminNote,
      refundAmount: money(r.refundAmount),
      refundShipping: money(r.refundShipping),
      refundTotal: fromKurus(toKurus(r.refundAmount) + toKurus(r.refundShipping)),
      refundMethod: r.refundMethod,
      refundError: r.refundError,
      refundInProgress: !!r.refundStartedAt && r.status !== 'REFUNDED',
      // Ödeme iyzico ile alındıysa iade otomatik; aksi halde (havale vb.) elle yapılıp işaretlenir
      autoRefund: auto || payment?.status === 'REFUNDED',
      restocked: r.restocked,
      createdAt: r.createdAt,
      decidedAt: r.decidedAt,
      receivedAt: r.receivedAt,
      refundedAt: r.refundedAt,
      order: r.order,
      items: r.items.map((i) => ({
        orderItemId: i.orderItemId,
        productName: i.orderItem.productName,
        variantName: i.orderItem.variantName,
        sku: i.orderItem.productSku,
        quantity: i.quantity,
        orderedQuantity: i.orderItem.quantity,
        amount: money(i.amount),
        refunded: !!i.refundedAt,
      })),
    };
  }

  async decide(id: string, decision: 'approve' | 'reject', note: string | undefined, actorId: string, ip?: string) {
    const text = note?.trim().slice(0, 1000) || null;
    if (decision === 'reject' && !text) throw new BadRequestException('Ret gerekçesi yazın (müşteriye gönderilir).');
    const { count } = await this.prisma.returnRequest.updateMany({
      where: { id, status: 'REQUESTED' },
      data: { status: decision === 'approve' ? 'APPROVED' : 'REJECTED', adminNote: text, decidedAt: new Date() },
    });
    if (count === 0) throw new ConflictException('Talep bu durumda değil; sayfayı yenileyin.');
    await this.audit.log({ action: `admin.return_${decision}`, entity: 'ReturnRequest', entityId: id, userId: actorId, ipAddress: ip });
    await (decision === 'approve' ? this.mails.approved(id) : this.mails.rejected(id)).catch(() => undefined);
    return this.get(id);
  }

  async receive(id: string, restock: boolean, actorId: string, ip?: string) {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.returnRequest.updateMany({ where: { id, status: 'APPROVED' }, data: { status: 'RECEIVED', receivedAt: new Date(), restocked: restock } });
      if (count === 0) throw new ConflictException('Yalnızca onaylanmış talep teslim alınabilir.');
      if (restock) await this.restock(tx, id);
    });
    await this.audit.log({ action: 'admin.return_received', entity: 'ReturnRequest', entityId: id, userId: actorId, ipAddress: ip, metaData: { restock } });
    return this.get(id);
  }

  /**
   * Ücret iadesi. Onaylanmış veya teslim alınmış talepte yapılır. Çift tıklamada iki kez
   * iade olmasın diye önce kilit alınır; iyzico'da yarıda kalırsa yalnızca kalan kalemler denenir.
   */
  async refund(id: string, manual: boolean, actorId: string, ip?: string) {
    const lock = await this.prisma.returnRequest.updateMany({
      where: { id, status: { in: ['APPROVED', 'RECEIVED'] }, refundStartedAt: null },
      data: { refundStartedAt: new Date(), refundError: null },
    });
    if (lock.count === 0) throw new ConflictException('İade şu anda yapılamaz (talep onaylanmamış, zaten iade edilmiş veya işlem sürüyor).');

    const r = await this.prisma.returnRequest.findUniqueOrThrow({ where: { id }, include: { items: { include: { orderItem: { select: { variantId: true } } } } } });
    const auto = !manual && (await this.refunds.autoRefundable(r.orderId));
    if (!manual && !auto) {
      await this.prisma.returnRequest.update({ where: { id }, data: { refundStartedAt: null } });
      throw new BadRequestException('Bu sipariş kartla (iyzico) ödenmemiş; iadeyi elle yapıp "Elle iade edildi" seçin.');
    }

    if (auto) {
      const parts = [
        ...r.items.filter((i) => !i.refundedAt).map((i) => ({ key: i.id, itemId: i.orderItem.variantId, amount: toKurus(i.amount) })),
        ...(toKurus(r.refundShipping) > 0 && !r.shippingRefundedAt ? [{ key: 'KARGO', itemId: 'KARGO', amount: toKurus(r.refundShipping) }] : []),
      ];
      const result = await this.refunds.refundParts(r.orderId, parts, ip);
      const now = new Date();
      const itemKeys = result.done.filter((k) => k !== 'KARGO');
      if (itemKeys.length) await this.prisma.returnItem.updateMany({ where: { id: { in: itemKeys } }, data: { refundedAt: now } });
      if (result.done.includes('KARGO')) await this.prisma.returnRequest.update({ where: { id }, data: { shippingRefundedAt: now } });
      if (result.error) {
        await this.prisma.returnRequest.update({ where: { id }, data: { refundStartedAt: null, refundError: result.error } });
        await this.audit.log({ action: 'admin.return_refund_failed', entity: 'ReturnRequest', entityId: id, userId: actorId, ipAddress: ip, metaData: { error: result.error } });
        throw new BadRequestException(`iyzico iadesi yapılamadı: ${result.error}`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.returnRequest.update({ where: { id }, data: { status: 'REFUNDED', refundedAt: new Date(), refundMethod: auto ? 'iyzico' : 'manual' } });
      await this.closeOrderIfFullyRefunded(tx, r.orderId, r.returnNumber, fromKurus(toKurus(r.refundAmount) + toKurus(r.refundShipping)), actorId);
    });
    await this.audit.log({ action: 'admin.return_refunded', entity: 'ReturnRequest', entityId: id, userId: actorId, ipAddress: ip, metaData: { method: auto ? 'iyzico' : 'manual' } });
    await this.mails.refunded(id).catch(() => undefined);
    return this.get(id);
  }

  private async restock(tx: Tx, returnId: string) {
    const items = await tx.returnItem.findMany({ where: { returnId }, select: { quantity: true, orderItem: { select: { variantId: true, variant: { select: { trackStock: true } } } } } });
    for (const i of items) {
      if (i.orderItem.variant.trackStock) await tx.productVariant.update({ where: { id: i.orderItem.variantId }, data: { stock: { increment: i.quantity } } });
    }
  }

  private async closeOrderIfFullyRefunded(tx: Tx, orderId: string, returnNumber: string, amount: string, actorId: string) {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_FOR_RETURNS });
    const refundedQty = new Map<string, number>();
    for (const r of order.returns.filter((x) => x.status === 'REFUNDED')) for (const i of r.items) refundedQty.set(i.orderItemId, (refundedQty.get(i.orderItemId) ?? 0) + i.quantity);
    const full = order.items.every((i) => (refundedQty.get(i.id) ?? 0) >= i.quantity);
    const note = `${returnNumber}: ${amount.replace('.', ',')} ₺ iade edildi.`;
    if (full && (order.status === 'DELIVERED' || order.status === 'SHIPPED')) {
      await tx.order.update({ where: { id: orderId }, data: { status: 'REFUNDED' } });
      await tx.orderEvent.create({ data: { orderId, status: 'REFUNDED', note, actorId } });
    } else {
      await tx.orderEvent.create({ data: { orderId, status: order.status, note: `Kısmi iade — ${note}`, actorId } });
    }
  }
}
