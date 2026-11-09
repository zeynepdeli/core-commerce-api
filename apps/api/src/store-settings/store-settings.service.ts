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

  /** Admin: kargo + satıcı bilgileri + ödeme süresi */
  async adminView() {
    const s = await this.row();
    return {
      ...(await this.view()),
      paymentTimeoutMinutes: s.paymentTimeoutMinutes,
      returnWindowDays: s.returnWindowDays,
      abandonedCartEnabled: s.abandonedCartEnabled,
      abandonedCartDelayHours: s.abandonedCartDelayHours,
      productFeedEnabled: s.productFeedEnabled,
      feedBrand: s.feedBrand,
      sellerName: s.sellerName,
      sellerAddress: s.sellerAddress,
      sellerPhone: s.sellerPhone,
      sellerEmail: s.sellerEmail,
      sellerTaxOffice: s.sellerTaxOffice,
      sellerTaxNumber: s.sellerTaxNumber,
      sellerMersisNo: s.sellerMersisNo,
    };
  }

  /** Yasal metinlerdeki satıcı bilgileri ve ödeme süresi */
  async seller() {
    const s = await this.row();
    return s;
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
        paymentTimeoutMinutes: dto.paymentTimeoutMinutes,
        returnWindowDays: dto.returnWindowDays,
        abandonedCartEnabled: dto.abandonedCartEnabled,
        abandonedCartDelayHours: dto.abandonedCartDelayHours,
        productFeedEnabled: dto.productFeedEnabled,
        feedBrand: dto.feedBrand?.trim() || (dto.feedBrand === undefined ? undefined : null),
        sellerName: dto.sellerName?.trim() || (dto.sellerName === undefined ? undefined : null),
        sellerAddress: dto.sellerAddress?.trim() || (dto.sellerAddress === undefined ? undefined : null),
        sellerPhone: dto.sellerPhone?.trim() || (dto.sellerPhone === undefined ? undefined : null),
        sellerEmail: dto.sellerEmail?.trim() || (dto.sellerEmail === undefined ? undefined : null),
        sellerTaxOffice: dto.sellerTaxOffice?.trim() || (dto.sellerTaxOffice === undefined ? undefined : null),
        sellerTaxNumber: dto.sellerTaxNumber ?? (dto.sellerTaxNumber === undefined ? undefined : null),
        sellerMersisNo: dto.sellerMersisNo ?? (dto.sellerMersisNo === undefined ? undefined : null),
      },
    });
    return this.adminView();
  }
}
