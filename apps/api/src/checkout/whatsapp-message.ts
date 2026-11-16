import { fromKurus, toKurus } from '../commerce/money.js';

type Line = {
  productName: string;
  variantName: string | null;
  quantity: number;
  lineTotal: string;
};
type Order = {
  orderNumber: string;
  items: Line[];
  shippingFee: string;
  discount: string;
  total: string;
  shippingAddress: unknown;
};

const tl = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
});
const money = (v: string) => tl.format(Number(fromKurus(toKurus(v))));
const MAX_TEXT = 1800;

/** Kontrol karakterlerini atar, tek satıra indirir (müşteri girdisi mesajı bozmasın) */
const clean = (v: unknown, max = 200) =>
  typeof v === 'string'
    ? v
        .replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max)
    : '';

/**
 * WhatsApp sipariş talebi bağlantısı (wa.me). Mesaj sunucuda, siparişin kayıtlı halinden
 * üretilir: müşteri tutarı ya da ürünleri değiştiremez; mağaza yalnızca bu adresi açar.
 */
export function whatsappOrderUrl(phone: string, order: Order): string {
  const a = (order.shippingAddress ?? {}) as Record<string, unknown>;
  const lines = order.items.map(
    (i) =>
      `• ${clean(i.productName, 120)}${i.variantName ? ` (${clean(i.variantName, 60)})` : ''} × ${i.quantity} = ${money(i.lineTotal)}`,
  );
  const parts = [
    'Merhaba, sipariş talebimi iletmek istiyorum.',
    `Sipariş No: ${order.orderNumber}`,
    '',
    ...lines,
    '',
    ...(Number(order.discount) > 0
      ? [`İndirim: −${money(order.discount)}`]
      : []),
    `Kargo: ${Number(order.shippingFee) > 0 ? money(order.shippingFee) : 'Ücretsiz'}`,
    `Toplam: ${money(order.total)}`,
    '',
    `Ad Soyad: ${clean(a.fullName, 100)}`,
    `Telefon: ${clean(a.phone, 20)}`,
    `Adres: ${clean(a.addressLine, 300)}, ${clean(a.district, 60)} / ${clean(a.city, 60)}`,
  ];
  let text = parts.join('\n');
  if (text.length > MAX_TEXT) text = `${text.slice(0, MAX_TEXT - 1)}…`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
