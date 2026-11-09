import { fromKurus, toKurus, vatIncluded } from './money.js';
import { type PricingCoupon, quote } from './pricing.js';

const settings = { shippingFee: 4990, freeShippingThreshold: 50000, minOrderAmount: null };
const line = (unitPrice: number, quantity = 1, vatRate = 20, variantId = 'v') => ({ variantId, unitPrice, quantity, vatRate });
const coupon = (over: Partial<PricingCoupon>): PricingCoupon => ({
  code: 'KOD',
  type: 'PERCENT',
  value: 10,
  maxDiscount: null,
  minSubtotal: null,
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  usedCount: 0,
  isActive: true,
  ...over,
});

describe('para', () => {
  it('kuruş çevirileri kayan nokta hatası yapmaz', () => {
    expect(toKurus('0.10') + toKurus('0.20')).toBe(30);
    expect(toKurus('249.9')).toBe(24990);
    expect(toKurus({ toFixed: () => '1249.90' })).toBe(124990);
    expect(fromKurus(24990)).toBe('249.90');
    expect(fromKurus(5)).toBe('0.05');
    expect(() => toKurus('1e5')).toThrow();
  });

  it('KDV dahil tutardan KDV', () => {
    expect(vatIncluded(12000, 20)).toBe(2000);
    expect(vatIncluded(11000, 10)).toBe(1000);
    expect(vatIncluded(10100, 1)).toBe(100);
  });
});

describe('quote', () => {
  it('kargo eşiğin altında ücretli, eşikte ücretsiz; kalan tutar', () => {
    const q = quote([line(24990)], settings, null);
    expect(q).toMatchObject({ subtotal: 24990, shipping: 4990, total: 29980, freeShippingRemaining: 25010 });
    expect(quote([line(25000, 2)], settings, null)).toMatchObject({ shipping: 0, total: 50000, freeShippingRemaining: null });
  });

  it('boş sepette kargo yok', () => {
    expect(quote([], settings, null)).toMatchObject({ subtotal: 0, shipping: 0, total: 0 });
  });

  it('yüzde kupon üst sınırla; indirim sonrası eşik kontrolü', () => {
    const q = quote([line(52000)], settings, coupon({ value: 20, maxDiscount: 5000 }));
    expect(q).toMatchObject({ discount: 5000, shipping: 4990, total: 52000 - 5000 + 4990, coupon: { code: 'KOD' } });
  });

  it('sabit kupon sepetten büyük olamaz; kargo bedava kuponu', () => {
    expect(quote([line(3000)], settings, coupon({ type: 'FIXED', value: 10000 }))).toMatchObject({ discount: 3000, total: 4990 });
    expect(quote([line(3000)], settings, coupon({ type: 'FREE_SHIPPING' }))).toMatchObject({ discount: 0, shipping: 0, total: 3000 });
  });

  it('geçersiz kupon uygulanmaz ve nedeni söylenir', () => {
    const now = new Date('2026-11-09T12:00:00Z');
    expect(quote([line(1000)], settings, coupon({ isActive: false }), now).couponError).toMatch(/kullanımda değil/);
    expect(quote([line(1000)], settings, coupon({ endsAt: new Date('2026-11-01') }), now).couponError).toMatch(/süresi doldu/);
    expect(quote([line(1000)], settings, coupon({ usageLimit: 5, usedCount: 5 }), now).couponError).toMatch(/hakkı doldu/);
    const q = quote([line(1000)], settings, coupon({ minSubtotal: 20000 }), now);
    expect(q.couponError).toMatch(/200,00 ₺/);
    expect(q.discount).toBe(0);
  });

  it('indirim satırlara orantılı dağılır, paylar toplamı indirimi verir, KDV oranlara göre', () => {
    const q = quote([line(10000, 1, 1, 'peynir'), line(20000, 1, 20, 'kase')], settings, coupon({ type: 'FIXED', value: 3001 }));
    expect(q.lines.reduce((s, l) => s + l.discountShare, 0)).toBe(3001);
    expect(q.lines[0].discountShare).toBe(1000);
    expect(q.vat).toBe(q.lines[0].vat + q.lines[1].vat + vatIncluded(q.shipping, 20));
  });

  it('en düşük sipariş tutarı', () => {
    expect(quote([line(5000)], { ...settings, minOrderAmount: 10000 }, null).belowMinimum).toBe(5000);
  });
});
