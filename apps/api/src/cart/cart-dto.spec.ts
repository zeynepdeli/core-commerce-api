import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateAddressDto } from '../addresses/addresses.dto.js';
import { normalizeCouponCode } from '../coupons/coupon-code.js';
import { ApplyCouponDto, CreateCouponDto } from '../coupons/coupons.dto.js';

import { SetCartItemDto } from './cart.dto.js';

const errors = async (cls: new () => object, body: object) =>
  (await validate(plainToInstance(cls, body), { whitelist: true, forbidNonWhitelisted: true })).map((e) => e.property);

describe('sepet / kupon / adres DTO', () => {
  it('sepete fiyat gönderilemez; adet 0–99', async () => {
    const id = '1b4e28ba-2fa1-11d2-883f-0016d3cca427';
    expect(await errors(SetCartItemDto, { variantId: id, quantity: 2 })).toEqual([]);
    expect(await errors(SetCartItemDto, { variantId: id, quantity: 2, price: 1 })).toContain('price');
    expect(await errors(SetCartItemDto, { variantId: id, quantity: 100 })).toContain('quantity');
    expect(await errors(SetCartItemDto, { variantId: id, quantity: 1.5 })).toContain('quantity');
  });

  it('kupon kodu Türkçe i/ı farkına duyarsız büyük harf', async () => {
    expect(normalizeCouponCode(' indirim ')).toBe('INDIRIM');
    expect(normalizeCouponCode('İNDİRİM')).toBe('INDIRIM');
    expect(plainToInstance(ApplyCouponDto, { code: 'yaz-ındırım' }).code).toBe('YAZ-INDIRIM');
    expect(await errors(CreateCouponDto, { code: 'a', type: 'PERCENT' })).toContain('code');
    expect(await errors(CreateCouponDto, { code: "X' OR 1=1", type: 'PERCENT' })).toContain('code');
  });

  it('adres: telefon biçimi normalize ve doğrulanır', async () => {
    const base = { title: 'Ev', fullName: 'Ayşe Yılmaz', city: 'İstanbul', district: 'Kadıköy', addressLine: 'Moda Cad. No:1' };
    const dto = plainToInstance(CreateAddressDto, { ...base, phone: '+90 (532) 123-45-67' });
    expect(dto.phone).toBe('+905321234567');
    expect(await errors(CreateAddressDto, { ...base, phone: '+90 (532) 123-45-67' })).toEqual([]);
    expect(await errors(CreateAddressDto, { ...base, phone: '12345' })).toContain('phone');
    expect(await errors(CreateAddressDto, { ...base, phone: '05321234567', userId: 'x' })).toContain('userId');
  });
});
