import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { isVideoUrl } from '../common/validators.js';

import { MAX_REVIEW_CARDS, SaveBlockDto } from './content.dto.js';
import { blockImageUrls } from './content.service.js';

const MEDIA = '/media/0f8fad5b-d9cb-469f-a165-70867728950e.webp';
const MEDIA2 = '/media/7c9e6679-7425-40de-944b-e07fc1f90ae7.png';

const errors = async (data: object) =>
  (
    await validate(plainToInstance(SaveBlockDto, { data }), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((e) => e.property);

describe('kategoriler bölümü', () => {
  const base = { type: 'CATEGORY_GRID' };

  it('eski sitedeki tüm ayarlar kabul edilir', async () => {
    expect(
      await errors({
        ...base,
        eyebrow: 'Keşfetmeye Devam Edin',
        title: 'Kategoriler',
        description:
          "Anadolu'nun en özel lezzetleri.\nHer kategori geleneksel üretimin izlerini taşır.",
        buttonLabel: 'İncele',
        videoUrl: 'https://res.cloudinary.com/demo/video/upload/v1/kapi.mp4',
        desktopBackground: MEDIA,
        mobileBackground: MEDIA2,
        categoryIds: ['0f8fad5b-d9cb-469f-a165-70867728950e'],
      }),
    ).toEqual([]);
    expect(
      await errors({ ...base, videoUrl: null, desktopBackground: '' }),
    ).toEqual([]);
  });

  it.each([
    ['http://site.com/video.mp4'],
    ['https://site.com/video.mov'],
    ['https://site.com/sayfa'],
    ['https://kullanici:sifre@site.com/v.mp4'],
    ['javascript:alert(1)//.mp4'],
    ['/videos/kapi.mp4'],
  ])('geçersiz video reddedilir: %s', async (videoUrl) => {
    expect(isVideoUrl(videoUrl)).toBe(false);
    expect(await errors({ ...base, videoUrl })).toEqual(['data']);
  });

  it('webm ve sorgulu adres kabul edilir', () => {
    expect(isVideoUrl('https://cdn.site.com/v/kapi.webm')).toBe(true);
    expect(isVideoUrl('https://cdn.site.com/v/kapi.mp4?v=2')).toBe(true);
  });
});

describe('müşteri yorumları bölümü', () => {
  const card = {
    name: 'Ayşe K.',
    rating: 5,
    comment: 'Peynirler çok taze geldi.',
    productImage: MEDIA,
  };

  it('geçerli kartlar', async () => {
    expect(
      await errors({
        type: 'REVIEWS',
        title: 'Müşterilerimizin Kalbinden',
        cards: [card, { ...card, userImage: MEDIA2, rating: 4 }],
      }),
    ).toEqual([]);
  });

  it.each([
    [{ cards: [] }],
    [{ cards: Array.from({ length: MAX_REVIEW_CARDS + 1 }, () => card) }],
    [{ cards: [{ ...card, rating: 0 }] }],
    [{ cards: [{ ...card, rating: 6 }] }],
    [{ cards: [{ ...card, rating: 4.5 }] }],
    [{ cards: [{ ...card, comment: '  ' }] }],
    [{ cards: [{ ...card, comment: 'x'.repeat(301) }] }],
    [{ cards: [{ ...card, name: 'a\nb' }] }],
    [{ cards: [{ ...card, productImage: 'http://kotu.site/a.png' }] }],
    [{ cards: [{ ...card, userImage: 'javascript:alert(1)' }] }],
    [{ cards: [{ ...card, extra: 1 }] }],
  ])('geçersiz yorum reddedilir: %o', async (data) => {
    expect(await errors({ type: 'REVIEWS', ...data })).toEqual(['data']);
  });

  it('yorum ve bölüm görselleri "kullanımda" sayılır (medyadan silinemez)', () => {
    expect(
      blockImageUrls({
        type: 'REVIEWS',
        cards: [{ productImage: MEDIA, userImage: MEDIA2 }],
        frameImage: MEDIA,
      }),
    ).toEqual([MEDIA, MEDIA2, MEDIA]);
    expect(
      blockImageUrls({
        type: 'CATEGORY_GRID',
        desktopBackground: MEDIA,
        mobileBackground: MEDIA2,
      }),
    ).toEqual([MEDIA, MEDIA2]);
  });
});
