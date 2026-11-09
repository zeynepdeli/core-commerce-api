import { fromKurus, type Kurus } from '../commerce/money.js';

export type BasketLine = { id: string; name: string; category: string; lineTotal: Kurus };
export type IyzicoBasketItem = { id: string; name: string; category1: string; itemType: 'PHYSICAL' | 'VIRTUAL'; price: string };

/**
 * iyzico sepeti: kalemlerin toplamı ödenecek tutara KURUŞU KURUŞUNA eşit olmalı.
 * İndirim satırlara tutarları oranında dağıtılır (yuvarlama farkı son satıra),
 * kargo ayrı kalem olur. 0 ₺ kalemler iyzico'ya gönderilemediği için atlanır.
 */
export function buildBasket(lines: BasketLine[], total: Kurus, shippingFee: Kurus): IyzicoBasketItem[] {
  const net = netLineTotals(lines, total, shippingFee);
  const items: IyzicoBasketItem[] = lines.map((l, index) => ({ id: l.id, name: clip(l.name), category1: clip(l.category), itemType: 'PHYSICAL', price: fromKurus(net[index]) }));
  if (shippingFee > 0) items.push({ id: 'KARGO', name: 'Kargo', category1: 'Kargo', itemType: 'VIRTUAL', price: fromKurus(shippingFee) });

  const result = items.filter((i) => i.price !== '0.00');
  const sum = result.reduce((s, i) => s + Math.round(Number(i.price) * 100), 0);
  if (sum !== total) throw new Error('Sepet toplamı hesaplanamadı');
  return result;
}

/**
 * Satırların indirim payı düşülmüş tutarları (kuruş). Ödeme sepeti ve iade tutarı
 * aynı fonksiyonla hesaplanır: iade edilen tutar iyzico'daki kalem tutarıyla birebir tutar.
 */
export function netLineTotals(lines: { lineTotal: Kurus }[], total: Kurus, shippingFee: Kurus): Kurus[] {
  const itemsTarget = total - shippingFee;
  const gross = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  if (itemsTarget < 0 || itemsTarget > gross) throw new Error('Sepet tutarı sipariş toplamıyla uyuşmuyor');
  const discount = gross - itemsTarget;
  let allocated = 0;
  return lines.map((l, index) => {
    const share = index === lines.length - 1 ? discount - allocated : Math.floor((discount * l.lineTotal) / (gross || 1));
    allocated += share;
    return l.lineTotal - share;
  });
}

/** "Ayşe Nur Yılmaz" → { name: "Ayşe Nur", surname: "Yılmaz" } */
export function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { name: parts[0] || 'Müşteri', surname: parts[0] || 'Müşteri' };
  return { name: parts.slice(0, -1).join(' '), surname: parts.at(-1) as string };
}

const clip = (s: string) => (s.trim() || '-').slice(0, 100);
