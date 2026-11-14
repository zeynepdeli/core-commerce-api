import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { UpdateSiteDto } from './content.dto.js';
import { mergeSiteImages, parseSiteImages } from './site-images.js';

const MEDIA = '/media/0f8fad5b-d9cb-469f-a165-70867728950e.webp';
const MEDIA2 = '/media/7c9e6679-7425-40de-944b-e07fc1f90ae7.png';

const errors = async (body: object) =>
  (
    await validate(plainToInstance(UpdateSiteDto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((e) => e.property);

describe('site görselleri', () => {
  it('medya görseli ve boşaltma kabul edilir', async () => {
    expect(
      await errors({
        siteImages: {
          footerBackground: MEDIA,
          productPlate: null,
          iconTexture: '',
        },
      }),
    ).toEqual([]);
  });

  it.each([
    ['http://site.com/x.png'],
    ['/images/logo.webp'],
    ['javascript:alert(1)'],
    ['/media/../../etc/passwd'],
    ['data:image/png;base64,AAAA'],
  ])('medya kütüphanesi ya da https dışı adres reddedilir: %s', async (url) => {
    expect(await errors({ siteImages: { footerBackground: url } })).toEqual([
      'siteImages',
    ]);
  });

  it('bilinmeyen alan adı reddedilir', async () => {
    expect(await errors({ siteImages: { heroBackground: MEDIA } })).toEqual([
      'siteImages',
    ]);
    expect(await errors({ siteImages: 'x' })).toEqual(['siteImages']);
  });

  it('değişiklikler mevcutların üstüne işlenir', () => {
    const current = { footerBackground: MEDIA, productPlate: MEDIA2 };
    expect(
      mergeSiteImages(current, { productPlate: null, iconTexture: MEDIA }),
    ).toEqual({ footerBackground: MEDIA, iconTexture: MEDIA });
    expect(mergeSiteImages(current, { footerBackground: undefined })).toEqual(
      current,
    );
  });

  it('veritabanındaki bozuk ya da bilinmeyen kayıtlar atlanır', () => {
    expect(
      parseSiteImages({
        footerBackground: MEDIA,
        productPlate: 'javascript:x',
        hacker: MEDIA,
      }),
    ).toEqual({ footerBackground: MEDIA });
    expect(parseSiteImages([MEDIA])).toEqual({});
    expect(parseSiteImages(null)).toEqual({});
  });
});
