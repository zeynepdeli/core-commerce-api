import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { UpdateSiteDto } from './content.dto.js';

const MEDIA = '/media/0f8fad5b-d9cb-469f-a165-70867728950e.png';

const errors = async (body: object) =>
  (
    await validate(plainToInstance(UpdateSiteDto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((e) => e.property);

describe('header teslimat kutusu ve metinleri', () => {
  it('geçerli değerler kabul edilir', async () => {
    expect(
      await errors({
        showDelivery: true,
        deliveryTitle: 'Teslimat Adresi',
        deliveryText: 'Konum Seçin',
        deliveryLink: '/hesabim/adresler',
        deliveryIconUrl: MEDIA,
        searchPlaceholder: 'Ürün ara...',
        loginText: 'Giriş Yap',
        accountText: 'Hesabım',
        cartText: 'Sepetim',
      }),
    ).toEqual([]);
    expect(await errors({ deliveryIconUrl: null })).toEqual([]);
    expect(await errors({ deliveryIconUrl: '' })).toEqual([]);
  });

  it.each([
    [{ deliveryLink: 'javascript:alert(1)' }, 'deliveryLink'],
    [{ deliveryLink: '//kotu.site' }, 'deliveryLink'],
    [{ deliveryIconUrl: 'http://site.com/a.png' }, 'deliveryIconUrl'],
    [{ deliveryTitle: '   ' }, 'deliveryTitle'],
    [{ deliveryText: 'a\nb' }, 'deliveryText'],
    [{ loginText: 'Çok uzun bir giriş yazısı' }, 'loginText'],
    [{ showDelivery: 'evet' }, 'showDelivery'],
  ])('geçersiz değer reddedilir: %o', async (body, field) => {
    expect(await errors(body)).toEqual([field]);
  });
});
