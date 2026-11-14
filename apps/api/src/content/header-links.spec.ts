import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { UpdateSiteDto } from './content.dto.js';
import { MAX_HEADER_LINKS, parseHeaderLinks } from './header-links.js';

const errors = async (body: object) =>
  (
    await validate(plainToInstance(UpdateSiteDto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((e) => e.property);

describe('header menü linkleri', () => {
  it('site içi ve https adresleri kabul eder', async () => {
    expect(
      await errors({
        headerLinks: [
          { label: 'Anasayfa', href: '/' },
          { label: 'Ürünlerimiz', href: '/urunler' },
          { label: 'Blog', href: 'https://blog.enfesgurme.com' },
        ],
      }),
    ).toEqual([]);
  });

  it.each([
    ['javascript:alert(1)'],
    ['//kotu.site'],
    ['http://enfesgurme.com'],
    ['urunler'],
    [''],
  ])('güvensiz adresi reddeder: %s', async (href) => {
    expect(await errors({ headerLinks: [{ label: 'X', href }] })).toEqual([
      'headerLinks',
    ]);
  });

  it('boş ad, çok satırlı ad ve fazladan alan reddedilir', async () => {
    expect(await errors({ headerLinks: [{ label: '  ', href: '/' }] })).toEqual(
      ['headerLinks'],
    );
    expect(
      await errors({ headerLinks: [{ label: 'a\nb', href: '/' }] }),
    ).toEqual(['headerLinks']);
    expect(
      await errors({ headerLinks: [{ label: 'A', href: '/', extra: 1 }] }),
    ).toEqual(['headerLinks']);
  });

  it(`en fazla ${MAX_HEADER_LINKS} link`, async () => {
    const many = Array.from({ length: MAX_HEADER_LINKS + 1 }, (_, i) => ({
      label: `L${i}`,
      href: '/',
    }));
    expect(await errors({ headerLinks: many })).toEqual(['headerLinks']);
  });

  it('veritabanındaki bozuk kayıtları atlar', () => {
    expect(
      parseHeaderLinks([
        { label: ' Ürünler ', href: '/urunler' },
        { label: 'Kötü', href: 'javascript:alert(1)' },
        { label: '', href: '/' },
        null,
        'x',
        { href: '/' },
      ]),
    ).toEqual([{ label: 'Ürünler', href: '/urunler' }]);
    expect(parseHeaderLinks({})).toEqual([]);
  });
});
