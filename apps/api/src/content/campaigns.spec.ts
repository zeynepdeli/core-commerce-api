import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service.js';
import { SaveCampaignDto, UpdateSiteDto } from './content.dto.js';
import { ContentService } from './content.service.js';
import { CAMPAIGN_PAGE_DEFAULTS, parseCampaignPage } from './page-settings.js';

const MEDIA = '/media/0f8fad5b-d9cb-469f-a165-70867728950e.webp';

const errors = async (body: object) =>
  (
    await validate(plainToInstance(SaveCampaignDto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((e) => e.property);

describe('Kampanya: doğrulama', () => {
  it('geçerli kampanya kabul edilir; kupon kodu büyük harfe çevrilir', async () => {
    const body = {
      title: 'Baklava Haftası',
      description: 'Satır 1\nSatır 2',
      badge: '%10',
      imageUrl: MEDIA,
      couponCode: ' kampanya10 ',
      linkUrl: '/urunlerimiz',
      linkLabel: 'Alışverişe Başla',
      startsAt: '2026-11-01T00:00:00.000Z',
      endsAt: '2026-11-30T00:00:00.000Z',
      isActive: true,
    };
    expect(await errors(body)).toEqual([]);
    expect(plainToInstance(SaveCampaignDto, body).couponCode).toBe(
      'KAMPANYA10',
    );
    // Boş alanlar: isteğe bağlı
    expect(
      await errors({
        title: 'Kampanya',
        imageUrl: '',
        couponCode: '',
        startsAt: null,
        endsAt: '',
      }),
    ).toEqual([]);
  });

  it.each([
    [{ title: '' }, 'title'],
    [{ title: 'x'.repeat(81) }, 'title'],
    [{ title: 'A', imageUrl: 'javascript:alert(1)' }, 'imageUrl'],
    [{ title: 'A', imageUrl: 'http://site.com/a.png' }, 'imageUrl'],
    [{ title: 'A', linkUrl: 'javascript:alert(1)' }, 'linkUrl'],
    [{ title: 'A', couponCode: 'İNDİRİM 10' }, 'couponCode'],
    [{ title: 'A', couponCode: 'AB' }, 'couponCode'],
    [{ title: 'A', startsAt: 'yarın' }, 'startsAt'],
    [{ title: 'A', badge: 'x'.repeat(25) }, 'badge'],
    [{ title: 'A', order: 3 }, 'order'],
  ])('geçersiz: %o', async (body, field) => {
    expect(await errors(body)).toContain(field);
  });

  it('sayfa metinleri: varsayılanlar ve sınırlar', async () => {
    expect(parseCampaignPage(null)).toEqual(CAMPAIGN_PAGE_DEFAULTS);
    expect(
      parseCampaignPage({
        title: 'FIRSATLAR',
        subtitle: 5,
        emptyText: 'x'.repeat(500),
      }),
    ).toEqual({
      ...CAMPAIGN_PAGE_DEFAULTS,
      title: 'FIRSATLAR',
    });
    const dto = await validate(
      plainToInstance(UpdateSiteDto, { campaignPage: { title: '' } }),
      {
        whitelist: true,
        forbidNonWhitelisted: true,
      },
    );
    expect(dto.map((e) => e.property)).toContain('campaignPage');
  });
});

const day = 86_400_000;
const now = new Date('2026-11-16T12:00:00Z');
const at = (offsetDays: number) => new Date(now.getTime() + offsetDays * day);
const campaign = (over: object) => ({
  id: 'c',
  title: 'K',
  description: null,
  badge: null,
  imageUrl: null,
  couponCode: null,
  linkUrl: null,
  linkLabel: null,
  startsAt: null,
  endsAt: null,
  order: 0,
  isActive: true,
  createdAt: now,
  updatedAt: now,
  ...over,
});

describe('Kampanya: mağaza listesi', () => {
  const service = (rows: object[], coupons: object[]) => {
    const coupon = { findMany: vi.fn().mockResolvedValue(coupons) };
    const svc = new ContentService({
      campaign: { findMany: vi.fn().mockResolvedValue(rows) },
      coupon,
    } as unknown as PrismaService);
    return { svc, coupon };
  };

  it('yalnızca tarih aralığındakiler listelenir; iç alanlar dışarı verilmez', async () => {
    const { svc } = service(
      [
        campaign({ id: 'a', startsAt: at(-1), endsAt: at(2) }),
        campaign({ id: 'gelecek', startsAt: at(1) }),
        campaign({ id: 'bitti', endsAt: at(-1) }),
        campaign({ id: 'suresiz' }),
      ],
      [],
    );
    const list = await svc.publicCampaigns(now);
    expect(list.map((c) => c.id)).toEqual(['a', 'suresiz']);
    expect(list[0]).not.toHaveProperty('isActive');
    expect(list[0]).not.toHaveProperty('order');
    expect(list[0]?.endsAt).toEqual(at(2));
  });

  it('kupon kodu yalnızca kupon şu an kullanılabiliyorsa gösterilir', async () => {
    const { svc, coupon } = service(
      [
        campaign({ id: 'gecerli', couponCode: 'OK10' }),
        campaign({ id: 'tukenmis', couponCode: 'BITTI' }),
        campaign({ id: 'suresi-gecmis', couponCode: 'ESKI' }),
        campaign({ id: 'yok', couponCode: 'HAYALI' }),
      ],
      [
        {
          code: 'OK10',
          startsAt: null,
          endsAt: at(5),
          usageLimit: 100,
          usedCount: 3,
        },
        {
          code: 'BITTI',
          startsAt: null,
          endsAt: null,
          usageLimit: 3,
          usedCount: 3,
        },
        {
          code: 'ESKI',
          startsAt: null,
          endsAt: at(-1),
          usageLimit: null,
          usedCount: 0,
        },
      ],
    );
    const list = await svc.publicCampaigns(now);
    expect(Object.fromEntries(list.map((c) => [c.id, c.couponCode]))).toEqual({
      gecerli: 'OK10',
      tukenmis: null,
      'suresi-gecmis': null,
      yok: null,
    });
    // Pasif kuponlar sorguda elenir
    expect(coupon.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { isActive: true },
    });
  });

  it('kampanya yoksa kupon tablosuna gidilmez', async () => {
    const { svc, coupon } = service([], []);
    expect(await svc.publicCampaigns(now)).toEqual([]);
    expect(coupon.findMany).not.toHaveBeenCalled();
  });
});

describe('Kampanya: yönetim', () => {
  it('bitiş başlangıçtan önceyse reddedilir', async () => {
    const svc = new ContentService({
      campaign: {},
    } as unknown as PrismaService);
    await expect(
      svc.saveCampaign(null, {
        title: 'A',
        startsAt: '2026-11-10T00:00:00Z',
        endsAt: '2026-11-01T00:00:00Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('yoksa 404; sıralama eksik/fazla id ile reddedilir', async () => {
    const svc = new ContentService({
      campaign: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        findMany: vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]),
      },
    } as unknown as PrismaService);
    await expect(svc.saveCampaign('x', { title: 'A' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(svc.deleteCampaign('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(svc.reorderCampaigns(['a'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(svc.reorderCampaigns(['a', 'a'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
