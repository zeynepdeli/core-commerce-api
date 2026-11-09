import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { fromKurus, toKurus } from '../commerce/money.js';
import type { PricingCoupon } from '../commerce/pricing.js';
import type { Coupon } from '../generated/prisma/client.js';
import { isUniqueViolation } from '../common/validators.js';
import { PrismaService } from '../prisma/prisma.service.js';

import type { CreateCouponDto, ListCouponsQueryDto, UpdateCouponDto } from './coupons.dto.js';

const PAGE = 25;
const money = (v: { toFixed(d: number): string } | null) => (v === null ? null : fromKurus(toKurus(v)));

export function toPricingCoupon(c: Coupon): PricingCoupon {
  return {
    code: c.code,
    type: c.type,
    // Yüzde kuponda value yüzdedir, diğerlerinde kuruş
    value: c.type === 'PERCENT' ? Number(c.value.toFixed(2)) : toKurus(c.value),
    maxDiscount: c.maxDiscount === null ? null : toKurus(c.maxDiscount),
    minSubtotal: c.minSubtotal === null ? null : toKurus(c.minSubtotal),
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    usageLimit: c.usageLimit,
    usedCount: c.usedCount,
    isActive: c.isActive,
  };
}

const view = (c: Coupon) => ({ ...c, value: money(c.value), maxDiscount: money(c.maxDiscount), minSubtotal: money(c.minSubtotal) });

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  findByCode(code: string) {
    return this.prisma.coupon.findUnique({ where: { code } });
  }

  async list(query: ListCouponsQueryDto) {
    const page = query.page ?? 1;
    const where = query.q ? { code: { contains: query.q } } : {};
    const [total, items] = await this.prisma.$transaction([
      this.prisma.coupon.count({ where }),
      this.prisma.coupon.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * PAGE, take: PAGE }),
    ]);
    return { items: items.map(view), total, page, pages: Math.max(1, Math.ceil(total / PAGE)) };
  }

  async create(dto: CreateCouponDto) {
    const data = this.validated(dto.type, dto);
    try {
      return view(await this.prisma.coupon.create({ data: { code: dto.code, type: dto.type, ...data } }));
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Bu kupon kodu zaten var.');
      throw error;
    }
  }

  async update(id: string, dto: UpdateCouponDto) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Kupon bulunamadı.');
    const merged = {
      value: dto.value ?? Number(existing.value.toFixed(2)),
      maxDiscount: dto.maxDiscount !== undefined ? dto.maxDiscount : existing.maxDiscount && Number(existing.maxDiscount.toFixed(2)),
      minSubtotal: dto.minSubtotal !== undefined ? dto.minSubtotal : existing.minSubtotal && Number(existing.minSubtotal.toFixed(2)),
      startsAt: dto.startsAt !== undefined ? dto.startsAt : existing.startsAt,
      endsAt: dto.endsAt !== undefined ? dto.endsAt : existing.endsAt,
      usageLimit: dto.usageLimit !== undefined ? dto.usageLimit : existing.usageLimit,
      perUserLimit: dto.perUserLimit !== undefined ? dto.perUserLimit : existing.perUserLimit,
      isActive: dto.isActive ?? existing.isActive,
    };
    const data = this.validated(existing.type, merged);
    return view(await this.prisma.coupon.update({ where: { id }, data }));
  }

  /** Kullanılmış kupon silinmez (sipariş kayıtları kodu gösterir); pasif yapılır */
  async remove(id: string) {
    const existing = await this.prisma.coupon.findUnique({ where: { id }, select: { usedCount: true } });
    if (!existing) throw new NotFoundException('Kupon bulunamadı.');
    if (existing.usedCount > 0) throw new ConflictException('Bu kupon siparişlerde kullanıldı; silmek yerine pasif yapın.');
    await this.prisma.coupon.delete({ where: { id } });
    return { success: true };
  }

  private validated(type: Coupon['type'], v: UpdateCouponDto) {
    const value = v.value ?? 0;
    if (type === 'PERCENT' && (value <= 0 || value > 100)) throw new BadRequestException('Yüzde indirim 0 ile 100 arasında olmalıdır.');
    if (type === 'FIXED' && value <= 0) throw new BadRequestException('İndirim tutarı 0\'dan büyük olmalıdır.');
    if (type !== 'PERCENT' && v.maxDiscount != null) throw new BadRequestException('En fazla indirim yalnızca yüzde kuponlarda kullanılır.');
    if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt) throw new BadRequestException('Bitiş tarihi başlangıçtan sonra olmalıdır.');
    return {
      value: type === 'FREE_SHIPPING' ? '0.00' : value.toFixed(2),
      maxDiscount: v.maxDiscount == null ? null : v.maxDiscount.toFixed(2),
      minSubtotal: v.minSubtotal == null ? null : v.minSubtotal.toFixed(2),
      startsAt: v.startsAt ?? null,
      endsAt: v.endsAt ?? null,
      usageLimit: v.usageLimit ?? null,
      perUserLimit: v.perUserLimit ?? null,
      isActive: v.isActive ?? true,
    };
  }
}
