/** Kupon kodu: büyük harf ASCII; Türkçe i/ı/İ farkı müşteriyi yormasın */
export function normalizeCouponCode(value: string): string {
  return value.trim().replace(/[ıİi]/g, 'I').toUpperCase();
}

export const COUPON_CODE_REGEX = /^[A-Z0-9_-]{3,32}$/;
