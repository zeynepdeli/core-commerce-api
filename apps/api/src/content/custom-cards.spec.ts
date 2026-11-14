import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { MAX_CUSTOM_CARDS, SaveBlockDto } from './content.dto.js';
import { blockImageUrls, customCards, storedBlock } from './content.service.js';

const MEDIA = '/media/0f8fad5b-d9cb-469f-a165-70867728950e.webp';
const card = {
  name: 'Antep Fıstıklı Helva',
  imageUrl: MEDIA,
  price: '149,90',
  link: '/urun/helva',
};

const check = async (data: object) => {
  const dto = plainToInstance(SaveBlockDto, {
    data: { type: 'PRODUCT_LIST', source: 'custom', ...data },
  });
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { errors: errors.map((e) => e.property), dto };
};

describe('elle girilen kartlar', () => {
  it('kart sayısı (limit) gerekmez; virgüllü fiyat noktaya çevrilir', async () => {
    const { errors, dto } = await check({
      cards: [card, { name: 'Zeytin', imageUrl: MEDIA }],
    });
    expect(errors).toEqual([]);
    expect((dto.data as { cards: { price: string }[] }).cards[0].price).toBe(
      '149.90',
    );
  });

  it.each([
    [{ cards: [] }],
    [{ cards: Array.from({ length: MAX_CUSTOM_CARDS + 1 }, () => card) }],
    [{ cards: [{ ...card, name: ' ' }] }],
    [{ cards: [{ ...card, imageUrl: 'http://kotu.site/a.png' }] }],
    [{ cards: [{ ...card, price: '12a' }] }],
    [{ cards: [{ ...card, price: '-5' }] }],
    [{ cards: [{ ...card, link: 'javascript:alert(1)' }] }],
    [{ cards: [{ ...card, extra: 1 }] }],
  ])('geçersiz kart reddedilir: %o', async (data) => {
    expect((await check(data)).errors).toEqual(['data']);
  });

  it('diğer kaynaklarda limit hâlâ zorunlu', async () => {
    const dto = plainToInstance(SaveBlockDto, {
      data: { type: 'PRODUCT_LIST', source: 'featured' },
    });
    expect((await validate(dto)).map((e) => e.property)).toEqual(['data']);
  });

  it('mağazaya giden biçim', () => {
    expect(
      customCards([
        { name: 'Helva', imageUrl: MEDIA, price: '149.9', soldOut: true },
      ]),
    ).toEqual([
      {
        name: 'Helva',
        image: { url: MEDIA, alt: null },
        price: '149.90',
        compareAtPrice: null,
        link: null,
        inStock: false,
      },
    ]);
  });

  it('kart görselleri "kullanımda" sayılır (medyadan silinemez)', () => {
    expect(
      blockImageUrls({ type: 'PRODUCT_LIST', cards: [{ imageUrl: MEDIA }] }),
    ).toEqual([MEDIA]);
  });

  it('yalnızca seçili kaynağın verisi saklanır', () => {
    const base = {
      type: 'PRODUCT_LIST' as const,
      limit: 4,
      productIds: ['p1'],
      cards: [{ name: 'X', imageUrl: MEDIA, hack: 1 } as never],
    };
    expect(storedBlock({ ...base, source: 'featured' } as never)).toEqual({
      type: 'PRODUCT_LIST',
      source: 'featured',
      limit: 4,
    });
    expect(storedBlock({ ...base, source: 'manual' } as never)).toEqual({
      type: 'PRODUCT_LIST',
      source: 'manual',
      limit: 4,
      productIds: ['p1'],
    });
    expect(storedBlock({ ...base, source: 'custom' } as never)).toMatchObject({
      cards: [{ name: 'X', imageUrl: MEDIA }],
    });
    expect(
      JSON.stringify(storedBlock({ ...base, source: 'custom' } as never)),
    ).not.toContain('hack');
  });
});
