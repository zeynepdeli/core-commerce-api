/**
 * Para hesapları KURUŞ cinsinden tam sayıyla yapılır: 0.1 + 0.2 gibi
 * kayan nokta hataları fiyatı bozmasın. Veritabanı Decimal(10,2) tutar.
 */
export type Kurus = number;

type DecimalLike = { toFixed(digits: number): string } | string | number;

export function toKurus(value: DecimalLike): Kurus {
  const text = typeof value === 'object' ? value.toFixed(2) : typeof value === 'number' ? value.toFixed(2) : value;
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) throw new Error(`Geçersiz tutar: ${text}`);
  const kurus = Number(match[2]) * 100 + Number((match[3] ?? '0').padEnd(2, '0'));
  return match[1] ? -kurus : kurus;
}

/** 24990 → "249.90" (API yanıtı ve veritabanı biçimi) */
export function fromKurus(kurus: Kurus): string {
  const sign = kurus < 0 ? '-' : '';
  const abs = Math.abs(Math.round(kurus));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** KDV dahil tutarın içindeki KDV (ör. %20: 120 ₺ → 20 ₺) */
export function vatIncluded(gross: Kurus, rate: number): Kurus {
  return Math.round(gross - gross / (1 + rate / 100));
}
