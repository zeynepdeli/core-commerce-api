import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { HERO_INTERVAL, SaveBlockDto } from './content.dto.js';

const MEDIA = '/media/0f8fad5b-d9cb-469f-a165-70867728950e.webp';

const errors = async (data: object) =>
  (
    await validate(
      plainToInstance(SaveBlockDto, {
        data: { type: 'HERO', slides: [{ imageUrl: MEDIA }], ...data },
      }),
      {
        whitelist: true,
        forbidNonWhitelisted: true,
      },
    )
  ).map((e) => e.property);

describe('slider süresi', () => {
  it('verilmezse geçerli (mağaza varsayılanı kullanır)', async () => {
    expect(await errors({})).toEqual([]);
  });

  it.each([HERO_INTERVAL.min, HERO_INTERVAL.default, HERO_INTERVAL.max])(
    '%i saniye kabul edilir',
    async (s) => {
      expect(await errors({ intervalSeconds: s })).toEqual([]);
    },
  );

  it.each([HERO_INTERVAL.min - 1, HERO_INTERVAL.max + 1, 4.5, '5', 0, -3])(
    'geçersiz süre reddedilir: %s',
    async (s) => {
      expect(await errors({ intervalSeconds: s })).toEqual(['data']);
    },
  );
});
