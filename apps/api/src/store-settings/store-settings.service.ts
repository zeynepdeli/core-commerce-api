import { BadRequestException, Injectable } from '@nestjs/common';

import { type Kurus, fromKurus, toKurus } from '../commerce/money.js';
import type { PricingSettings } from '../commerce/pricing.js';
import { PrismaService } from '../prisma/prisma.service.js';

import type { UpdateStoreSettingsDto } from './store-settings.dto.js';

const ID = 1;
const orNull = (v: { toFixed(d: number): string } | null) => (v === null ? null : fromKurus(toKurus(v)));

@Injectable()
export class StoreSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async row() {
    return (
      (await this.prisma.storeSettings.findUnique({ where: { id: ID } })) ??
      this.prisma.storeSettings.create({ data: { id: ID } })
    );
  }

  /** Fiyat hesabı için (kuruş) */
  async pricing(): Promise<PricingSettings> {
    const s = await this.row();
    return {
      shippingFee: toKurus(s.shippingFee),
      freeShippingThreshold: s.freeShippingThreshold === null ? null : toKurus(s.freeShippingThreshold),
      minOrderAmount: s.minOrderAmount === null ? null : toKurus(s.minOrderAmount),
    };
  }

  /** Mağaza ve admin için (metin tutarlar) */
  async view() {
    const s = await this.row();
    return {
      shippingFee: fromKurus(toKurus(s.shippingFee)),
      freeShippingThreshold: orNull(s.freeShippingThreshold),
      minOrderAmount: orNull(s.minOrderAmount),
      currency: 'TRY',
    };
  }

  async update(dto: UpdateStoreSettingsDto) {
    const fee: Kurus | undefined = dto.shippingFee === undefined ? undefined : Math.round(dto.shippingFee * 100);
    if (dto.freeShippingThreshold === 0) throw new BadRequestException('Ücretsiz kargo eşiği 0 olamaz; her zaman ücretsiz için kargo ücretini 0 yapın.');
    await this.row();
    await this.prisma.storeSettings.update({
      where: { id: ID },
      data: {
        shippingFee: fee === undefined ? undefined : fromKurus(fee),
        freeShippingThreshold: dto.freeShippingThreshold === undefined ? undefined : dto.freeShippingThreshold === null ? null : dto.freeShippingThreshold.toFixed(2),
        minOrderAmount: dto.minOrderAmount === undefined ? undefined : dto.minOrderAmount === null ? null : dto.minOrderAmount.toFixed(2),
      },
    });
    return this.view();
  }
}
