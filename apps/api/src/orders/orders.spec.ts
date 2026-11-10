import { BadRequestException, ConflictException } from '@nestjs/common';

import { renderTemplate } from '../legal/legal.service.js';

import { newOrderNumber } from './order-number.js';
import { OrdersService, TRANSITIONS } from './orders.service.js';

const audit = { log: vi.fn() };
const mails = { paid: vi.fn().mockResolvedValue(undefined), shipped: vi.fn().mockResolvedValue(undefined), cancelled: vi.fn().mockResolvedValue(undefined) };

function prismaMock(order: Record<string, unknown> | null, updateCount = 1) {
  const tx = {
    order: { updateMany: vi.fn().mockResolvedValue({ count: updateCount }) },
    orderEvent: { create: vi.fn() },
    orderItem: { findMany: vi.fn().mockResolvedValue([{ variantId: 'v1', quantity: 2, variant: { trackStock: true } }, { variantId: 'v2', quantity: 1, variant: { trackStock: false } }]) },
    productVariant: { update: vi.fn() },
    couponRedemption: { findUnique: vi.fn().mockResolvedValue({ id: 'r1', couponId: 'c1' }), delete: vi.fn() },
    coupon: { updateMany: vi.fn() },
    cartItem: { deleteMany: vi.fn() },
    cart: { updateMany: vi.fn() },
  };
  return {
    tx,
    order: { findUnique: vi.fn().mockResolvedValue(order), findMany: vi.fn().mockResolvedValue([{ id: 'o1' }, { id: 'o2' }]) },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
}

describe('sipariş numarası', () => {
  it('yıl + 8 karakter, karışan karakter yok', () => {
    const n = newOrderNumber(new Date('2026-05-01'));
    expect(n).toMatch(/^2026-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    expect(new Set(Array.from({ length: 200 }, () => newOrderNumber())).size).toBe(200);
  });
});

describe('OrdersService', () => {
  it('iptal: stok (yalnızca takip edilen) ve kupon geri alınır', async () => {
    const prisma = prismaMock({ status: 'PENDING' });
    await new OrdersService(prisma as never, audit as never, mails as never).cancel('o1', 'test', null);
    expect(prisma.tx.productVariant.update).toHaveBeenCalledTimes(1);
    expect(prisma.tx.productVariant.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { stock: { increment: 2 } } });
    expect(prisma.tx.couponRedemption.delete).toHaveBeenCalled();
    expect(prisma.tx.coupon.updateMany).toHaveBeenCalledWith({ where: { id: 'c1', usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
  });

  it('zaten iptal edilmiş sipariş tekrar iptal edilemez (stok iki kez eklenmez)', async () => {
    const prisma = prismaMock({ status: 'CANCELLED' }, 0);
    await expect(new OrdersService(prisma as never, audit as never, mails as never).cancel('o1', 'x', null)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.tx.productVariant.update).not.toHaveBeenCalled();
  });

  it('geçersiz geçiş reddedilir; kargoya verirken takip no zorunlu', async () => {
    const svc = new OrdersService(prismaMock({ status: 'PENDING' }) as never, audit as never, mails as never);
    await expect(svc.transition('o1', 'SHIPPED', 'admin', {})).rejects.toBeInstanceOf(BadRequestException);
    const svc2 = new OrdersService(prismaMock({ status: 'PROCESSING' }) as never, audit as never, mails as never);
    await expect(svc2.transition('o1', 'SHIPPED', 'admin', {})).rejects.toThrow(/takip numarası/);
  });

  it('ödendi: kaynak sepet boşaltılır', async () => {
    const prisma = prismaMock({ status: 'PENDING', sourceCartId: 'cart1' });
    await new OrdersService(prisma as never, audit as never, mails as never).transition('o1', 'PAID', 'admin', {});
    expect(prisma.tx.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: 'cart1' } });
  });

  it('ödeme süresi dolanlar iptal edilir; bu arada ödenmiş olan atlanır', async () => {
    const prisma = prismaMock({ status: 'PENDING' });
    prisma.tx.order.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await new OrdersService(prisma as never, audit as never, mails as never).expireUnpaid()).toBe(1);
  });

  it('teslim edilen/iptal edilen siparişte geçiş kuralları', () => {
    expect(TRANSITIONS.CANCELLED).toEqual([]);
    expect(TRANSITIONS.SHIPPED).toEqual(['DELIVERED']);
  });
});

describe('yasal şablon', () => {
  it('yer tutucular doldurulur, bilinmeyen kalır, kontrol karakterleri temizlenir', () => {
    expect(renderTemplate('{{ALICI_AD}} – {{BILINMEYEN}}', { ALICI_AD: 'Ayşe\u0000' })).toBe('Ayşe – {{BILINMEYEN}}');
    expect(renderTemplate('{{SATICI_MERSIS}}', { SATICI_MERSIS: '' })).toBe('-');
  });
});
