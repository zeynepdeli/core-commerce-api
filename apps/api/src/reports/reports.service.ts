import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { fromKurus, toKurus } from '../commerce/money.js';
import type { Env } from '../config/env.validation.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

import type { SalesReportQueryDto } from './reports.dto.js';

const MAX_DAYS = 366;
const DAY = 86_400_000;
const CSV_LIMIT = 20_000;

type Unit = 'day' | 'week' | 'month';
type Range = { from: string; to: string; days: number; start: string; end: string };

/** Para alanları SQL'de metin olarak döner (kayan nokta hatası yok), kuruşa çevrilir */
const k = (v: unknown) => (v === null || v === undefined ? 0 : toKurus(String(v)));
const pct = (now: number, before: number) => (before === 0 ? null : Math.round(((now - before) / before) * 1000) / 10);
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/**
 * Satış raporları. "Satış" = ödemesi alınmış sipariş (ödeme tarihine göre).
 * İadeler ayrı sayılır: iade tarihinde düşülür (iade talebiyle yapılan iadeler +
 * ödendikten sonra iptal edilen siparişler). Gün sınırları mağaza saat dilimine göredir.
 * Tüm sorgular parametreli (SQL injection yok) ve tarih aralığı en fazla 1 yıl.
 */
@Injectable()
export class ReportsService {
  private readonly tz: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.tz = config.get('STORE_TIMEZONE', { infer: true });
  }

  /** Mağaza saat dilimine göre bugün (YYYY-AA-GG) */
  today(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: this.tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  }

  /** Yerel gün aralığı → veritabanındaki UTC sınırları (yaz saati dahil, PostgreSQL hesaplar) */
  private async range(from: string, to: string): Promise<Range> {
    if (Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) throw new BadRequestException('Tarih geçersiz.');
    const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
    if (days < 1) throw new BadRequestException('Başlangıç tarihi bitişten sonra olamaz.');
    if (days > MAX_DAYS) throw new BadRequestException('Rapor aralığı en fazla 1 yıl olabilir.');
    const [b] = await this.prisma.$queryRaw<{ start: string; end: string }[]>`
      SELECT to_char((${from}::date::timestamp AT TIME ZONE ${this.tz}) AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') AS start,
             to_char((${addDays(to, 1)}::date::timestamp AT TIME ZONE ${this.tz}) AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') AS "end"`;
    return { from, to, days, start: b.start, end: b.end };
  }

  private resolve(query: SalesReportQueryDto) {
    const to = query.to ?? this.today();
    const from = query.from ?? addDays(to, -29);
    return { from, to };
  }

  // ───────────── Özet ─────────────

  private async totals(r: Range) {
    const [sales] = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT count(*)::int AS orders,
             coalesce(sum(total), 0)::text AS gross,
             coalesce(sum(subtotal), 0)::text AS subtotal,
             coalesce(sum(discount), 0)::text AS discount,
             coalesce(sum("shippingFee"), 0)::text AS shipping,
             coalesce(sum("vatTotal"), 0)::text AS vat,
             count(DISTINCT lower(email))::int AS customers
      FROM "Order"
      WHERE "paidAt" >= ${r.start}::timestamp AND "paidAt" < ${r.end}::timestamp`;
    const [items] = await this.prisma.$queryRaw<{ qty: number }[]>`
      SELECT coalesce(sum(oi.quantity), 0)::int AS qty
      FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."paidAt" >= ${r.start}::timestamp AND o."paidAt" < ${r.end}::timestamp`;
    const [refunds] = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT (SELECT coalesce(sum("refundAmount" + "refundShipping"), 0) FROM "ReturnRequest"
               WHERE status = 'REFUNDED' AND "refundedAt" >= ${r.start}::timestamp AND "refundedAt" < ${r.end}::timestamp)::text AS returns,
             (SELECT count(*) FROM "ReturnRequest"
               WHERE status = 'REFUNDED' AND "refundedAt" >= ${r.start}::timestamp AND "refundedAt" < ${r.end}::timestamp)::int AS "returnCount",
             (SELECT coalesce(sum(total), 0) FROM "Order"
               WHERE "paidAt" IS NOT NULL AND status = 'CANCELLED' AND "cancelledAt" >= ${r.start}::timestamp AND "cancelledAt" < ${r.end}::timestamp)::text AS cancelled,
             (SELECT count(*) FROM "Order"
               WHERE "paidAt" IS NOT NULL AND status = 'CANCELLED' AND "cancelledAt" >= ${r.start}::timestamp AND "cancelledAt" < ${r.end}::timestamp)::int AS "cancelCount"`;
    const gross = k(sales.gross);
    const refundTotal = k(refunds.returns) + k(refunds.cancelled);
    const orders = sales.orders as number;
    return {
      orders,
      gross,
      net: gross - refundTotal,
      refunds: refundTotal,
      returnRefunds: k(refunds.returns),
      cancelRefunds: k(refunds.cancelled),
      returnCount: refunds.returnCount as number,
      cancelCount: refunds.cancelCount as number,
      subtotal: k(sales.subtotal),
      discount: k(sales.discount),
      shipping: k(sales.shipping),
      vat: k(sales.vat),
      aov: orders ? Math.round(gross / orders) : 0,
      customers: sales.customers as number,
      itemsSold: items.qty,
    };
  }

  async sales(query: SalesReportQueryDto) {
    const { from, to } = this.resolve(query);
    const r = await this.range(from, to);
    const unit: Unit = query.groupBy ?? (r.days <= 62 ? 'day' : r.days <= 182 ? 'week' : 'month');
    const prev = await this.range(addDays(from, -r.days), addDays(from, -1));

    const [now, before, series, products, categories, coupons, customers, funnel] = await Promise.all([
      this.totals(r),
      this.totals(prev),
      this.series(r, unit),
      this.topProducts(r),
      this.categories(r),
      this.coupons(r),
      this.customerMix(r),
      this.funnel(r),
    ]);

    const m = (v: number) => fromKurus(v);
    return {
      range: { from, to, days: r.days, groupBy: unit, timezone: this.tz },
      previous: { from: prev.from, to: prev.to },
      summary: {
        orders: now.orders,
        gross: m(now.gross),
        net: m(now.net),
        refunds: m(now.refunds),
        returnRefunds: m(now.returnRefunds),
        cancelRefunds: m(now.cancelRefunds),
        returnCount: now.returnCount,
        cancelCount: now.cancelCount,
        subtotal: m(now.subtotal),
        discount: m(now.discount),
        shipping: m(now.shipping),
        vat: m(now.vat),
        aov: m(now.aov),
        itemsSold: now.itemsSold,
        customers: now.customers,
      },
      change: {
        orders: pct(now.orders, before.orders),
        gross: pct(now.gross, before.gross),
        net: pct(now.net, before.net),
        aov: pct(now.aov, before.aov),
        itemsSold: pct(now.itemsSold, before.itemsSold),
      },
      series,
      topProducts: products,
      categories,
      coupons,
      customers,
      funnel,
    };
  }

  /** Boş günler de (0 ile) döner: grafik kesintisiz */
  private async series(r: Range, unit: Unit) {
    const step = `1 ${unit}`;
    const rows = await this.prisma.$queryRaw<{ bucket: string; orders: number; revenue: string }[]>`
      WITH o AS (
        SELECT date_trunc(${unit}, ("paidAt" AT TIME ZONE 'UTC') AT TIME ZONE ${this.tz}) AS bucket, count(*) AS n, sum(total) AS rev
        FROM "Order"
        WHERE "paidAt" >= ${r.start}::timestamp AND "paidAt" < ${r.end}::timestamp
        GROUP BY 1
      )
      SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket, coalesce(o.n, 0)::int AS orders, coalesce(o.rev, 0)::text AS revenue
      FROM generate_series(date_trunc(${unit}, ${r.from}::date::timestamp), date_trunc(${unit}, ${r.to}::date::timestamp), ${step}::interval) AS b(bucket)
      LEFT JOIN o ON o.bucket = b.bucket
      ORDER BY b.bucket`;
    return rows.map((x) => ({ date: x.bucket, orders: x.orders, revenue: fromKurus(k(x.revenue)) }));
  }

  /** Ürün bazında (satır tutarı = indirim öncesi) */
  private async topProducts(r: Range) {
    const rows = await this.prisma.$queryRaw<{ productId: string; name: string; qty: number; revenue: string; orders: number }[]>`
      SELECT oi."productId" AS "productId", max(oi."productName") AS name, sum(oi.quantity)::int AS qty,
             sum(oi.price * oi.quantity)::text AS revenue, count(DISTINCT oi."orderId")::int AS orders
      FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."paidAt" >= ${r.start}::timestamp AND o."paidAt" < ${r.end}::timestamp
      GROUP BY oi."productId"
      ORDER BY sum(oi.price * oi.quantity) DESC, max(oi."productName")
      LIMIT 10`;
    return rows.map((x) => ({ productId: x.productId, name: x.name, quantity: x.qty, orders: x.orders, revenue: fromKurus(k(x.revenue)) }));
  }

  private async categories(r: Range) {
    const rows = await this.prisma.$queryRaw<{ id: string; name: string; qty: number; revenue: string }[]>`
      SELECT c.id, c.name, sum(oi.quantity)::int AS qty, sum(oi.price * oi.quantity)::text AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      JOIN "Product" p ON p.id = oi."productId"
      JOIN "Category" c ON c.id = p."categoryId"
      WHERE o."paidAt" >= ${r.start}::timestamp AND o."paidAt" < ${r.end}::timestamp
      GROUP BY c.id, c.name
      ORDER BY sum(oi.price * oi.quantity) DESC
      LIMIT 20`;
    return rows.map((x) => ({ categoryId: x.id, name: x.name, quantity: x.qty, revenue: fromKurus(k(x.revenue)) }));
  }

  private async coupons(r: Range) {
    const rows = await this.prisma.$queryRaw<{ code: string; uses: number; discount: string; revenue: string }[]>`
      SELECT "couponCode" AS code, count(*)::int AS uses, sum(discount)::text AS discount, sum(total)::text AS revenue
      FROM "Order"
      WHERE "paidAt" >= ${r.start}::timestamp AND "paidAt" < ${r.end}::timestamp AND "couponCode" IS NOT NULL
      GROUP BY "couponCode"
      ORDER BY count(*) DESC, "couponCode"
      LIMIT 20`;
    return rows.map((x) => ({ code: x.code, uses: x.uses, discount: fromKurus(k(x.discount)), revenue: fromKurus(k(x.revenue)) }));
  }

  /** Yeni müşteri: ilk ödenmiş siparişi bu aralıkta olan (e-postaya göre; misafir + üye) */
  private async customerMix(r: Range) {
    const [row] = await this.prisma.$queryRaw<{ new: number; returning: number; members: number; guests: number }[]>`
      WITH c AS (
        SELECT lower(email) AS email FROM "Order"
        WHERE "paidAt" >= ${r.start}::timestamp AND "paidAt" < ${r.end}::timestamp
        GROUP BY lower(email)
      ),
      f AS (
        SELECT lower(o.email) AS email, min(o."paidAt") AS first_paid
        FROM "Order" o JOIN c ON c.email = lower(o.email)
        WHERE o."paidAt" IS NOT NULL
        GROUP BY lower(o.email)
      )
      SELECT count(*) FILTER (WHERE first_paid >= ${r.start}::timestamp)::int AS new,
             count(*) FILTER (WHERE first_paid < ${r.start}::timestamp)::int AS returning,
             (SELECT count(*) FROM "Order" WHERE "paidAt" >= ${r.start}::timestamp AND "paidAt" < ${r.end}::timestamp AND "userId" IS NOT NULL)::int AS members,
             (SELECT count(*) FROM "Order" WHERE "paidAt" >= ${r.start}::timestamp AND "paidAt" < ${r.end}::timestamp AND "userId" IS NULL)::int AS guests
      FROM f`;
    return { new: row.new, returning: row.returning, memberOrders: row.members, guestOrders: row.guests };
  }

  /** Bu aralıkta OLUŞTURULAN siparişlerin akıbeti (ödeme dönüşümü) */
  private async funnel(r: Range) {
    const [row] = await this.prisma.$queryRaw<{ created: number; paid: number; unpaid_cancelled: number; pending: number }[]>`
      SELECT count(*)::int AS created,
             count(*) FILTER (WHERE "paidAt" IS NOT NULL)::int AS paid,
             count(*) FILTER (WHERE "paidAt" IS NULL AND status = 'CANCELLED')::int AS unpaid_cancelled,
             count(*) FILTER (WHERE status = 'PENDING')::int AS pending
      FROM "Order"
      WHERE "createdAt" >= ${r.start}::timestamp AND "createdAt" < ${r.end}::timestamp`;
    const [failed] = await this.prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "Payment" p JOIN "Order" o ON o.id = p."orderId"
      WHERE p.status = 'FAILED' AND o."createdAt" >= ${r.start}::timestamp AND o."createdAt" < ${r.end}::timestamp`;
    return {
      created: row.created,
      paid: row.paid,
      abandoned: row.unpaid_cancelled,
      pending: row.pending,
      failedPayments: failed.n,
      conversion: row.created ? Math.round((row.paid / row.created) * 1000) / 10 : null,
    };
  }

  // ───────────── CSV (muhasebe) ─────────────

  /**
   * Ödenmiş siparişler. Türkçe Excel için: UTF-8 BOM, ";" ayraç, "," ondalık.
   * CSV/formül enjeksiyonu: =, +, -, @ ile başlayan metin hücreleri ' ile etkisizleştirilir.
   */
  async salesCsv(query: SalesReportQueryDto) {
    const { from, to } = this.resolve(query);
    const r = await this.range(from, to);
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
      SELECT o."orderNumber", to_char((o."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE ${this.tz}, 'DD.MM.YYYY HH24:MI') AS paid,
             o.status::text AS status, o.email, o."shippingAddress"->>'fullName' AS name,
             o."billingInfo"->>'type' AS "billingType", o."billingInfo"->>'companyName' AS company,
             o."billingInfo"->>'taxNumber' AS "taxNumber", o."billingInfo"->>'identityNumber' AS "identityNumber",
             o.subtotal::text AS subtotal, o.discount::text AS discount, o."shippingFee"::text AS shipping,
             o."vatTotal"::text AS vat, o.total::text AS total, o."couponCode" AS coupon,
             coalesce(p.provider, 'manuel') AS provider,
             (SELECT coalesce(sum(rr."refundAmount" + rr."refundShipping"), 0) FROM "ReturnRequest" rr WHERE rr."orderId" = o.id AND rr.status = 'REFUNDED')::text AS refunded
      FROM "Order" o LEFT JOIN "Payment" p ON p."orderId" = o.id AND p.status IN ('SUCCEEDED', 'REFUNDED')
      WHERE o."paidAt" >= ${r.start}::timestamp AND o."paidAt" < ${r.end}::timestamp
      ORDER BY o."paidAt"
      LIMIT ${CSV_LIMIT + 1}`);
    if (rows.length > CSV_LIMIT) throw new BadRequestException(`Bu aralıkta ${CSV_LIMIT} siparişten fazlası var; aralığı daraltın.`);

    const STATUS: Record<string, string> = { PAID: 'Ödendi', PROCESSING: 'Hazırlanıyor', SHIPPED: 'Kargoda', DELIVERED: 'Teslim edildi', CANCELLED: 'İptal (iade)', REFUNDED: 'İade edildi', PENDING: 'Bekliyor' };
    const money = (v: unknown) => fromKurus(k(v)).replace('.', ',');
    const header = ['Sipariş No', 'Ödeme Tarihi', 'Durum', 'Müşteri', 'E-posta', 'Fatura Tipi', 'Unvan', 'VKN/TCKN', 'Ara Toplam', 'İndirim', 'Kargo', 'KDV', 'Toplam', 'İade Edilen', 'Kupon', 'Ödeme'];
    const lines = rows.map((x) => [
      x.orderNumber,
      x.paid,
      STATUS[String(x.status)] ?? x.status,
      x.name,
      x.email,
      x.billingType === 'CORPORATE' ? 'Kurumsal' : 'Bireysel',
      x.company,
      x.taxNumber ?? x.identityNumber,
      money(x.subtotal),
      money(x.discount),
      money(x.shipping),
      money(x.vat),
      money(x.total),
      x.status === 'CANCELLED' ? money(x.total) : money(x.refunded),
      x.coupon,
      x.provider === 'iyzico' ? 'Kart (iyzico)' : 'Havale/EFT',
    ]);
    const body = [header, ...lines].map((cells) => cells.map(csvCell).join(';')).join('\r\n');
    return { filename: `satislar_${from}_${to}.csv`, content: `﻿${body}\r\n` };
  }
}

export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  // Formül enjeksiyonu (OWASP CSV Injection)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
