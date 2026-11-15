import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';

import { ABOUT_IMAGE_FIELDS, hasAboutContent } from './about.js';
import { UpdateAboutDto } from './content.dto.js';
import { ContentService } from './content.service.js';

const MEDIA = '/media/0f8fad5b-d9cb-469f-a165-70867728950e.webp';

const errors = async (body: object) =>
  (
    await validate(plainToInstance(UpdateAboutDto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((e) => e.property);

describe('Hakkımızda: doğrulama', () => {
  it('geçerli değerler kabul edilir', async () => {
    expect(
      await errors({
        isPublished: true,
        backgroundColor: '#efe3cc',
        ...Object.fromEntries(ABOUT_IMAGE_FIELDS.map((f) => [f, MEDIA])),
        visionTitle: 'Vizyonumuz',
        visionText: 'Satır 1\nSatır 2',
        missionHeading: 'Misyonumuz',
        missionTitle: 'Geleneksel lezzet',
        missionText: 'Metin',
        storyHeading: 'Hikayemiz',
        storyTitle: 'Antep’ten sofranıza',
        storyText: 'Metin',
        valuesHeading: 'Değerlerimiz',
        valuesTitle: 'Doğallık',
        valuesText: 'Metin',
        metaTitle: 'Hakkımızda',
        metaDescription: 'Açıklama',
      }),
    ).toEqual([]);
    // Boş / null görsel: mağaza varsayılanı
    expect(
      await errors({ visionImage: '', storyImage: null, visionText: null }),
    ).toEqual([]);
  });

  it.each([
    [{ visionImage: 'javascript:alert(1)' }, 'visionImage'],
    [{ sketchImage1: 'http://site.com/a.png' }, 'sketchImage1'],
    [{ backgroundColor: 'red; background:url(x)' }, 'backgroundColor'],
    [{ visionTitle: '   ' }, 'visionTitle'],
    [{ missionHeading: 'a\nb' }, 'missionHeading'],
    [{ storyText: 'x'.repeat(601) }, 'storyText'],
    [{ metaTitle: 'x'.repeat(71) }, 'metaTitle'],
    [{ isPublished: 'evet' }, 'isPublished'],
    [{ bilinmeyen: 'x' }, 'bilinmeyen'],
  ])('geçersiz değer reddedilir: %o', async (body, field) => {
    expect(await errors(body)).toEqual([field]);
  });
});

describe('Hakkımızda: mağaza', () => {
  const row = (over: object = {}) => ({
    id: 1,
    isPublished: true,
    updatedAt: new Date(),
    visionTitle: 'Vizyonumuz',
    visionText: null,
    missionTitle: null,
    missionText: null,
    storyTitle: null,
    storyText: null,
    valuesTitle: null,
    valuesText: null,
    ...over,
  });
  const service = (data: object) =>
    new ContentService({
      aboutPage: { findUnique: vi.fn().mockResolvedValue(data) },
    } as never);

  it('yalnızca varsayılan başlıklar varsa sayfa boş sayılır', () => {
    expect(hasAboutContent(row())).toBe(false);
    expect(hasAboutContent(row({ storyText: '  ' }))).toBe(false);
    expect(hasAboutContent(row({ storyText: 'Hikaye' }))).toBe(true);
  });

  it('boş ya da yayında olmayan sayfa 404', async () => {
    await expect(service(row()).publicAbout()).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service(row({ storyText: 'Hikaye', isPublished: false })).publicAbout(),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('yayındaki sayfa iç alanlar olmadan döner', async () => {
    const about = await service(row({ storyText: 'Hikaye' })).publicAbout();
    expect(about).toMatchObject({
      storyText: 'Hikaye',
      visionTitle: 'Vizyonumuz',
    });
    expect(about).not.toHaveProperty('id');
    expect(about).not.toHaveProperty('isPublished');
    expect(about).not.toHaveProperty('updatedAt');
  });
});
