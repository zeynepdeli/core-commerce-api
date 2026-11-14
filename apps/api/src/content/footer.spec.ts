import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import {
  MAX_FOOTER_LINKS,
  UpdateFooterDto,
  UpdateSiteDto,
} from './content.dto.js';
import { normalizeFooterLink, parseFooterLinks } from './footer-links.js';

const errors = async (cls: new () => object, body: object) =>
  (
    await validate(plainToInstance(cls, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((e) => e.property);

describe('footer sosyal bağlantıları', () => {
  it('marka ikonu yalnızca kendi alan adına gider', () => {
    expect(
      normalizeFooterLink({
        icon: 'instagram',
        label: 'Instagram',
        url: 'https://www.instagram.com/enfes',
      }).url,
    ).toBe('https://www.instagram.com/enfes');
    expect(
      normalizeFooterLink({
        icon: 'whatsapp',
        label: 'WhatsApp',
        url: 'https://wa.me/905321234567',
      }).url,
    ).toBe('https://wa.me/905321234567');
    expect(() =>
      normalizeFooterLink({
        icon: 'instagram',
        label: 'Instagram',
        url: 'https://kotu.site/instagram',
      }),
    ).toThrow('instagram.com');
    // Alt alan adı ya da benzer ad hile değildir
    expect(() =>
      normalizeFooterLink({
        icon: 'instagram',
        label: 'Instagram',
        url: 'https://instagram.com.kotu.site/x',
      }),
    ).toThrow();
  });

  it('yalnızca https; kullanıcı bilgisi içeren adresler reddedilir', () => {
    expect(() =>
      normalizeFooterLink({
        icon: 'web',
        label: 'Blog',
        url: 'http://blog.ornek.com',
      }),
    ).toThrow('https://');
    expect(() =>
      normalizeFooterLink({
        icon: 'web',
        label: 'Blog',
        url: 'javascript:alert(1)',
      }),
    ).toThrow();
    expect(() =>
      normalizeFooterLink({
        icon: 'instagram',
        label: 'Instagram',
        url: 'https://www.instagram.com@kotu.site/x',
      }),
    ).toThrow();
    expect(() =>
      normalizeFooterLink({
        icon: 'web',
        label: 'Blog',
        url: 'https://user:pass@blog.ornek.com',
      }),
    ).toThrow();
    expect(() =>
      normalizeFooterLink({ icon: 'web', label: 'Blog', url: 'bozuk adres' }),
    ).toThrow('geçersiz');
  });

  it('"web" ikonunda alan adı serbest ama gerçek bir alan adı olmalı', () => {
    expect(
      normalizeFooterLink({
        icon: 'web',
        label: 'Blog',
        url: 'https://blog.ornek.com/yazi',
      }).url,
    ).toBe('https://blog.ornek.com/yazi');
    expect(() =>
      normalizeFooterLink({
        icon: 'web',
        label: 'Yerel',
        url: 'https://localhost/x',
      }),
    ).toThrow();
  });

  it('veritabanındaki bozuk kayıtlar okunurken atlanır', () => {
    expect(
      parseFooterLinks([
        {
          icon: 'instagram',
          label: 'Instagram',
          url: 'https://www.instagram.com/x',
        },
        {
          icon: 'linkedin',
          label: 'LinkedIn',
          url: 'https://www.linkedin.com/x',
        },
        { icon: 'web', label: 'Kötü', url: 'javascript:alert(1)' },
        { icon: 'x', label: 1, url: 'https://x.com/y' },
        null,
        'metin',
      ]),
    ).toEqual([
      {
        icon: 'instagram',
        label: 'Instagram',
        url: 'https://www.instagram.com/x',
      },
    ]);
    expect(
      parseFooterLinks({ instagram: 'https://www.instagram.com/x' }),
    ).toEqual([]);
    expect(parseFooterLinks(null)).toEqual([]);
  });
});

describe('UpdateFooterDto', () => {
  const link = {
    icon: 'instagram',
    label: 'Instagram',
    url: 'https://www.instagram.com/enfes',
  };

  it('geçerli istek', async () => {
    expect(
      await errors(UpdateFooterDto, {
        description: 'Antep lezzetleri\nkapınızda',
        socialLinks: [link],
        pagesTitle: 'Kurumsal',
        showCampaign: true,
        campaignButtonLink: '/kayit',
        copyrightText: null,
        contactPhone: '+90 (532) 123 45 67',
        footerPageIds: ['1b4e28ba-2fa1-11d2-883f-0016d3cca427'],
      }),
    ).toEqual([]);
  });

  it('bilinmeyen ikon, fazladan alan ve sınır aşımı reddedilir', async () => {
    expect(
      await errors(UpdateFooterDto, {
        socialLinks: [{ ...link, icon: 'linkedin' }],
      }),
    ).toContain('socialLinks');
    expect(
      await errors(UpdateFooterDto, {
        socialLinks: [{ ...link, svg: '<svg onload=alert(1)>' }],
      }),
    ).toContain('socialLinks');
    expect(
      await errors(UpdateFooterDto, {
        socialLinks: Array.from({ length: MAX_FOOTER_LINKS + 1 }, () => link),
      }),
    ).toContain('socialLinks');
    expect(
      await errors(UpdateFooterDto, { socialLinks: [{ ...link, label: '' }] }),
    ).toContain('socialLinks');
  });

  it('başlıklar boş bırakılamaz, tek satır olmalı; buton bağlantısı güvenli olmalı', async () => {
    expect(await errors(UpdateFooterDto, { pagesTitle: '' })).toContain(
      'pagesTitle',
    );
    expect(await errors(UpdateFooterDto, { contactTitle: 'a\nb' })).toContain(
      'contactTitle',
    );
    expect(
      await errors(UpdateFooterDto, {
        campaignButtonLink: 'javascript:alert(1)',
      }),
    ).toContain('campaignButtonLink');
    expect(
      await errors(UpdateFooterDto, { campaignButtonLink: '//kotu.site' }),
    ).toContain('campaignButtonLink');
    expect(await errors(UpdateFooterDto, { footerPageIds: ['1'] })).toContain(
      'footerPageIds',
    );
  });

  it('Görünüm formu artık sosyal medya ve iletişim alanı kabul etmez (tek düzenleme yeri: Footer)', async () => {
    expect(await errors(UpdateSiteDto, { socialLinks: {} })).toContain(
      'socialLinks',
    );
    expect(await errors(UpdateSiteDto, { contactEmail: 'a@b.com' })).toContain(
      'contactEmail',
    );
  });
});
