import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { UpdateSiteDto } from './content.dto.js';
import {
  CONTACT_PAGE_DEFAULTS,
  FAQ_PAGE_DEFAULTS,
  parseContactPage,
  parseFaqPage,
} from './page-settings.js';

const MEDIA = '/media/0f8fad5b-d9cb-469f-a165-70867728950e.webp';
const errors = async (body: object) =>
  (
    await validate(plainToInstance(UpdateSiteDto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((e) => e.property);

describe('iletişim ve S.S.S. sayfası ayarları', () => {
  it('boş kayıt varsayılan metinleri verir', () => {
    expect(parseContactPage({})).toEqual(CONTACT_PAGE_DEFAULTS);
    expect(parseFaqPage(null)).toEqual(FAQ_PAGE_DEFAULTS);
  });

  it('bozuk alan tek başına varsayılana döner', () => {
    const c = parseContactPage({
      title: 'Bize Yazın',
      mapTitle: 'a\nb',
      mapImage: 'javascript:alert(1)',
      mapLink: 'javascript:alert(1)',
    });
    expect(c).toMatchObject({
      title: 'Bize Yazın',
      mapTitle: CONTACT_PAGE_DEFAULTS.mapTitle,
      mapImage: null,
      mapLink: null,
    });
    expect(
      parseFaqPage({ buttonLink: '//kotu.site', title: 'x'.repeat(81) }),
    ).toMatchObject({
      buttonLink: '/iletisim',
      title: FAQ_PAGE_DEFAULTS.title,
    });
  });

  it('geçerli ayarlar kabul edilir', async () => {
    expect(
      await errors({
        contactPage: {
          title: 'İletişim',
          mapTitle: 'GAZİANTEP',
          mapSubtitle: 'Şahinbey',
          mapImage: MEDIA,
          mapLink: 'https://maps.google.com/?q=enfes',
        },
        faqPage: {
          title: 'S.S.S.',
          subtitle: 'Merak ettikleriniz',
          contactTitle: 'Sorunuz mu var?',
          buttonText: 'Bize Yazın',
          buttonLink: '/iletisim',
        },
      }),
    ).toEqual([]);
    expect(
      await errors({ contactPage: { mapImage: null, mapLink: null } }),
    ).toEqual([]);
  });

  it.each([
    [{ contactPage: { mapImage: 'http://x.com/a.png' } }],
    [{ contactPage: { mapLink: 'javascript:alert(1)' } }],
    [{ faqPage: { title: '' } }],
    [{ faqPage: { bilinmeyen: 1 } }],
  ])('geçersiz: %o', async (body) => {
    expect((await errors(body)).length).toBe(1);
  });
});
