import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

import type { CreateAddressDto } from './addresses.dto.js';

export const MAX_ADDRESSES = 20;

const SELECT = {
  id: true,
  title: true,
  fullName: true,
  phone: true,
  city: true,
  district: true,
  addressLine: true,
  zipCode: true,
  isDefault: true,
} as const;

/** Müşterinin adres defteri. Her sorgu userId ile sınırlı (başkasının adresi görülemez/değiştirilemez — IDOR). */
@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.address.findMany({ where: { userId }, select: SELECT, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
  }

  async create(userId: string, dto: CreateAddressDto) {
    const count = await this.prisma.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) throw new BadRequestException(`En fazla ${MAX_ADDRESSES} adres kaydedilebilir.`);
    const isDefault = dto.isDefault ?? count === 0;
    return this.prisma.$transaction(async (tx) => {
      if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.create({ data: { ...this.data(dto), userId, isDefault }, select: SELECT });
    });
  }

  async update(userId: string, id: string, dto: CreateAddressDto) {
    await this.own(userId, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({ where: { id }, data: { ...this.data(dto), ...(dto.isDefault ? { isDefault: true } : {}) }, select: SELECT });
    });
  }

  async remove(userId: string, id: string) {
    const address = await this.own(userId, id);
    // Siparişe bağlı adres silinmez; siparişler kendi adres kopyasını tutar (sipariş adımı)
    const used = await this.prisma.order.count({ where: { addressId: id } });
    if (used > 0) throw new BadRequestException('Bu adres bir siparişte kullanıldı; silinemez.');
    await this.prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id } });
      if (address.isDefault) {
        const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
        if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
    return { success: true };
  }

  private async own(userId: string, id: string) {
    const address = await this.prisma.address.findFirst({ where: { id, userId }, select: { id: true, isDefault: true } });
    if (!address) throw new NotFoundException('Adres bulunamadı.');
    return address;
  }

  private data(dto: CreateAddressDto) {
    return {
      title: dto.title,
      fullName: dto.fullName,
      phone: dto.phone,
      city: dto.city,
      district: dto.district,
      addressLine: dto.addressLine,
      zipCode: dto.zipCode || null,
    };
  }
}
