import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { MAX_FEATURE_ITEMS, SaveBlockDto } from './content.dto.js';
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

const item = (title = 'Doğal ve Katkısız', icon = 'leaf') => ({ icon, title });

describe("avantajlar (Antep'in Bereketi)", () => {
  const base = { type: 'FEATURES', items: [item()] };

  it('eski sitedeki tüm ayarlar kabul edilir', async () => {
    expect(
      await errors({
        ...base,
        title: "ANTEP'İN BEREKETİ",
        description:
          "Gaziantep'in köklü mutfak mirasını\nmodern sofralara taşıyoruz.",
        backgroundImage: MEDIA,
        cardTexture: MEDIA2,
        items: [
          item('Doğal', 'leaf'),
          item('Ödüllü', 'award'),
          item('Güvenli', 'shield'),
          item('Paketleme', 'package'),
        ],
      }),
    ).toEqual([]);
    // Boş görsel: mağaza varsayılanı
    expect(
      await errors({
        ...base,
        backgroundImage: null,
        cardTexture: '',
        description: null,
      }),
    ).toEqual([]);
  });

  it.each([
    [{ backgroundImage: 'javascript:alert(1)' }],
    [{ cardTexture: 'http://site.com/doku.png' }],
    [{ description: 'x'.repeat(301) }],
    [{ items: [] }],
    [{ items: Array.from({ length: MAX_FEATURE_ITEMS + 1 }, () => item()) }],
    [{ items: [item('Doğal', 'bomb')] }],
    [{ items: [item('x'.repeat(41))] }],
  ])('geçersiz değer reddedilir: %o', async (over) => {
    expect(await errors({ ...base, ...over })).toEqual(['data']);
  });

  it('arka plan ve kart dokusu medyada "kullanımda" sayılır', () => {
    expect(
      blockImageUrls({ ...base, backgroundImage: MEDIA, cardTexture: MEDIA2 }),
    ).toEqual([MEDIA, MEDIA2]);
  });
});
