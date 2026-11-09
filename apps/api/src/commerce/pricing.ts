import { type Kurus, fromKurus, toKurus, vatIncluded } from './money.js';

/** Kargo hizmetinin KDV oranı */
export const SHIPPING_VAT_RATE = 20;

export type PricingLine = {
  variantId: string;
  quantity: number;
  unitPrice: Kurus;
  vatRate: number;
};

export type PricingCoupon = {
  code: string;
  type: 'PERCENT' | 'FIXED' | 'FREE_SHIPPING';
  value: Kurus | number; // PERCENT için yüzde, FIXED için kuruş
  maxDiscount: Kurus | null;
  minSubtotal: Kurus | null;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
};

export type PricingSettings = {
  shippingFee: Kurus;
  freeShippingThreshold: Kurus | null;
  minOrderAmount: Kurus | null;
};

export type Quote = {
  subtotal: Kurus;
  discount: Kurus;
  shipping: Kurus;
  total: Kurus;
  vat: Kurus;
  /** Uygulanan kupon (geçersizse null + couponError) */
  coupon: { code: string; type: PricingCoupon['type'] } | null;
  couponError: string | null;
  /** Ücretsiz kargoya kalan tutar (yoksa null) */
  freeShippingRemaining: Kurus | null;
  /** En düşük sipariş tutarının altındaysa eksik tutar */
  belowMinimum: Kurus | null;
  /** Her satırın indirim sonrası payı (fatura/KDV için) */
  lines: { variantId: string; lineTotal: Kurus; discountShare: Kurus; vat: Kurus }[];
};

/** Kupon şu an bu sepete uygulanabilir mi? Uygulanamıyorsa nedeni */
export function couponProblem(coupon: PricingCoupon, subtotal: Kurus, now = new Date()): string | null {
  if (!coupon.isActive) return 'Bu kupon kullanımda değil.';
  if (coupon.startsAt && coupon.startsAt > now) return 'Bu kupon henüz başlamadı.';
  if (coupon.endsAt && coupon.endsAt <= now) return 'Bu kuponun süresi doldu.';
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return 'Bu kuponun kullanım hakkı doldu.';
  if (coupon.minSubtotal !== null && subtotal < coupon.minSubtotal) {
    return `Bu kupon en az ${fromKurus(coupon.minSubtotal).replace('.', ',')} ₺ tutarındaki sepetlerde geçerlidir.`;
  }
  return null;
}

/**
 * Sepet/sipariş tutarı — TEK YERDE ve SUNUCUDA hesaplanır; tarayıcıdan
 * gelen hiçbir fiyat kullanılmaz. Saf fonksiyon: aynı girdi → aynı sonuç
 * (sepet ekranı ve sipariş oluşturma aynı hesabı kullanır).
 */
export function quote(lines: PricingLine[], settings: PricingSettings, coupon: PricingCoupon | null, now = new Date()): Quote {
  const lineTotals = lines.map((l) => ({ ...l, lineTotal: l.unitPrice * l.quantity }));
  const subtotal = lineTotals.reduce((sum, l) => sum + l.lineTotal, 0);

  let couponError: string | null = null;
  let applied: PricingCoupon | null = null;
  if (coupon) {
    couponError = couponProblem(coupon, subtotal, now);
    if (!couponError) applied = coupon;
  }

  let discount = 0;
  if (applied?.type === 'PERCENT') {
    discount = Math.floor((subtotal * Number(applied.value)) / 100);
    if (applied.maxDiscount !== null) discount = Math.min(discount, applied.maxDiscount);
  } else if (applied?.type === 'FIXED') {
    discount = Math.min(Number(applied.value), subtotal);
  }

  const afterDiscount = subtotal - discount;
  const freeByThreshold = settings.freeShippingThreshold !== null && afterDiscount >= settings.freeShippingThreshold;
  const shipping = subtotal === 0 || freeByThreshold || applied?.type === 'FREE_SHIPPING' ? 0 : settings.shippingFee;

  // İndirimi satırlara tutarlarıyla orantılı dağıt (KDV doğru hesaplansın);
  // yuvarlama artığı son satıra eklenir → paylar toplamı = indirim
  let allocated = 0;
  const shares = lineTotals.map((l, index) => {
    const share =
      index === lineTotals.length - 1 ? discount - allocated : subtotal === 0 ? 0 : Math.floor((discount * l.lineTotal) / subtotal);
    allocated += share;
    const net = l.lineTotal - share;
    return { variantId: l.variantId, lineTotal: l.lineTotal, discountShare: share, vat: vatIncluded(net, l.vatRate) };
  });

  const vat = shares.reduce((sum, l) => sum + l.vat, 0) + vatIncluded(shipping, SHIPPING_VAT_RATE);
  const total = afterDiscount + shipping;

  return {
    subtotal,
    discount,
    shipping,
    total,
    vat,
    coupon: applied ? { code: applied.code, type: applied.type } : null,
    couponError,
    freeShippingRemaining:
      settings.freeShippingThreshold !== null && subtotal > 0 && !freeByThreshold && applied?.type !== 'FREE_SHIPPING'
        ? settings.freeShippingThreshold - afterDiscount
        : null,
    belowMinimum: settings.minOrderAmount !== null && afterDiscount < settings.minOrderAmount ? settings.minOrderAmount - afterDiscount : null,
    lines: shares,
  };
}

export { toKurus };
