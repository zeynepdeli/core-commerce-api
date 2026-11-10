import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { fromKurus, toKurus } from '../commerce/money.js';
import { PrismaService } from '../prisma/prisma.service.js';

const MAX_FAVORITES = 500;
const PAGE = 24;

/** Favoriler (beğenilenler). Ekle/çıkar idempotent: çift tıklama sorun olmaz */
@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mağazanın kalp ikonları için yalnızca kimlikler */
  async ids(userId: string) {
    const rows = await this.prisma.like.findMany({ where: { userId }, select: { productId: true }, orderBy: { createdAt: 'desc' }, take: MAX_FAVORITES });
    return rows.map((r) => r.productId);
  }

  async list(userId: string, page = 1) {
    const where = { userId, product: { isActive: true, deletedAt: null } };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.like.count({ where }),
      this.prisma.like.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE,
        take: PAGE,
        select: {
          createdAt: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              compareAtPrice: true,
              ratingAvg: true,
              ratingCount: true,
              images: { orderBy: { order: 'asc' }, take: 1, select: { url: true, alt: true } },
              variants: { where: { isActive: true, deletedAt: null }, select: { stock: true, trackStock: true } },
            },
          },
        },
      }),
    ]);
    return {
      items: rows.map(({ product: p, createdAt }) => ({
        productId: p.id,
        name: p.name,
        slug: p.slug,
        price: fromKurus(toKurus(p.price)),
        compareAtPrice: p.compareAtPrice ? fromKurus(toKurus(p.compareAtPrice)) : null,
        rating: p.ratingCount ? { average: Number(p.ratingAvg), count: p.ratingCount } : null,
        image: p.images[0] ?? null,
        inStock: p.variants.some((v) => !v.trackStock || v.stock > 0),
        addedAt: createdAt,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE)),
    };
  }

  async add(userId: string, productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, isActive: true, deletedAt: null }, select: { id: true } });
    if (!product) throw new NotFoundException('Ürün bulunamadı.');
    const count = await this.prisma.like.count({ where: { userId } });
    if (count >= MAX_FAVORITES) throw new BadRequestException(`En fazla ${MAX_FAVORITES} favori eklenebilir.`);
    await this.prisma.like.upsert({ where: { userId_productId: { userId, productId } }, create: { userId, productId }, update: {} });
    return { favorite: true };
  }

  async remove(userId: string, productId: string) {
    await this.prisma.like.deleteMany({ where: { userId, productId } });
    return { favorite: false };
  }
}
