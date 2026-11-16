import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { UpdateSiteDto } from './content.dto.js';
import { mergeSiteImages, parseSiteImages } from './site-images.js';

const MEDIA = '/media/0f8fad5b-d9cb-469f-a165-70867728950e.webp';

const errors = async (body: object) =>
  (
    await validate(plainToInstance(UpdateSiteDto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((e) => e.property);

describe('ürün detay sayfası ayarları', () => {
  it('yazılar ve görseller kabul edilir', async () => {
    expect(
      await errors({
        productLabelText: 'Özel Lezzet',
        addToCartText: 'Sepete Ekle',
        buyNowText: 'Hemen Al',
        quantityText: 'Miktar',
        siteImages: {
          productPageBackground: MEDIA,
          productDecorOne: MEDIA,
          productDecorTwo: null,
        },
      }),
    ).toEqual([]);
  });

  it.each([
    [{ addToCartText: '' }, 'addToCartText'],
    [{ buyNowText: 'Hemen\nAl' }, 'buyNowText'],
    [{ productLabelText: 'x'.repeat(25) }, 'productLabelText'],
    [{ siteImages: { productDecorOne: 'javascript:alert(1)' } }, 'siteImages'],
  ])('geçersiz değer reddedilir: %o', async (body, field) => {
    expect(await errors(body)).toEqual([field]);
  });

  it('görseller site görselleri listesinde saklanır, boş değer varsayılana döner', () => {
    const merged = mergeSiteImages(
      { productPageBackground: MEDIA, productDecorOne: MEDIA },
      { productDecorOne: null },
    );
    expect(parseSiteImages(merged)).toEqual({ productPageBackground: MEDIA });
  });
});
