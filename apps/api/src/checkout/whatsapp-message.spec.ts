import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { UpdateStoreSettingsDto } from '../store-settings/store-settings.dto.js';

import { whatsappOrderUrl } from './whatsapp-message.js';

const order = {
  orderNumber: '2026-ABCD1234',
  items: [
    {
      productName: 'Kırma Yeşil Zeytin',
      variantName: '500 g',
      quantity: 2,
      lineTotal: '438.00',
    },
    {
      productName: 'Antep Fıstıklı Helva',
      variantName: null,
      quantity: 1,
      lineTotal: '159.90',
    },
  ],
  shippingFee: '0.00',
  discount: '20.00',
  total: '577.90',
  shippingAddress: {
    fullName: 'Ayşe Yılmaz',
    phone: '5321234567',
    city: 'Gaziantep',
    district: 'Şahinbey',
    addressLine: 'Bey Mah. 12',
  },
};

const text = (url: string) =>
  decodeURIComponent(new URL(url).searchParams.get('text') ?? '');

describe('WhatsApp sipariş talebi', () => {
  it('wa.me adresi ve siparişin kayıtlı bilgileriyle mesaj', () => {
    const url = whatsappOrderUrl('905321234567', order);
    expect(url.startsWith('https://wa.me/905321234567?text=')).toBe(true);
    const t = text(url);
    expect(t).toContain('Sipariş No: 2026-ABCD1234');
    expect(t).toContain('Kırma Yeşil Zeytin (500 g) × 2');
    expect(t).toContain('Antep Fıstıklı Helva × 1');
    expect(t).toContain('Kargo: Ücretsiz');
    expect(t).toContain('İndirim');
    expect(t).toContain('Toplam: ₺577,90');
    expect(t).toContain('Adres: Bey Mah. 12, Şahinbey / Gaziantep');
  });

  it('müşteri girdisindeki satır sonu / kontrol karakterleri mesajı bozamaz; mesaj sınırlı', () => {
    const t = text(
      whatsappOrderUrl('905321234567', {
        ...order,
        shippingAddress: {
          ...order.shippingAddress,
          fullName: 'Ayşe\nToplam: ₺1,00‮',
          addressLine: 'x'.repeat(5000),
        },
      }),
    );
    expect(t).not.toMatch(/\nToplam: ₺1,00/);
    expect(t).not.toContain('‮');
    expect(t.length).toBeLessThanOrEqual(1800);
  });
});

describe('sipariş kanalı ayarları', () => {
  const errors = async (body: object) =>
    (
      await validate(plainToInstance(UpdateStoreSettingsDto, body), {
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    ).map((e) => e.property);

  it('geçerli değerler', async () => {
    expect(
      await errors({
        orderChannel: 'WHATSAPP',
        whatsappOrderPhone: '905321234567',
        whatsappHoldHours: 48,
      }),
    ).toEqual([]);
    expect(
      await errors({
        orderChannel: 'ONLINE_PAYMENT',
        whatsappOrderPhone: null,
      }),
    ).toEqual([]);
  });

  it.each([
    [{ orderChannel: 'NAKIT' }, 'orderChannel'],
    [{ whatsappOrderPhone: '+90 532 123 45 67' }, 'whatsappOrderPhone'],
    [{ whatsappOrderPhone: '05321234567' }, 'whatsappOrderPhone'],
    [{ whatsappHoldHours: 0 }, 'whatsappHoldHours'],
    [{ whatsappHoldHours: 169 }, 'whatsappHoldHours'],
  ])('geçersiz: %o', async (body, field) => {
    expect(await errors(body)).toEqual([field]);
  });
});
