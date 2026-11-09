import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { isUniqueViolation, uniqueViolationFields } from '../common/validators.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

import type { AdminProductQueryDto, ProductSort, PublicProductQueryDto } from './dto/catalog-query.dto.js';
import type { CreateProductDto, ProductImageDto, ProductTabDto, UpdateProductDto } from './dto/product.dto.js';
import { retiredValue } from './soft-delete.js';

/** Bu adedin altındaki stok admin'de "azaldı" olarak işaretlenir */
export const LOW_STOCK_THRESHOLD = 5;
// Kaynak tüketimini sınırla (OWASP API4)
export const MAX_PRODUCTS = 5000;

type Money = { toFixed(digits: number): string };
const money = (value: Money | null) => (value == null ? null : value.toFixed(2));

const NOT_DELETED = { deletedAt: null } as const;

/** Ziyaretçiye yalnızca yayındaki ürünler; kategorisi gizli/silinmişse ürün de gizli */
const VISIBLE: Prisma.ProductWhereInput = {
  isActive: true,
  deletedAt: null,
  category: { isActive: true, deletedAt: null },
};

const SORTS: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  new: [{ createdAt: 'desc' }, { id: 'asc' }],
  'price-asc': [{ price: 'asc' }, { id: 'asc' }],
  'price-desc': [{ price: 'desc' }, { id: 'asc' }],
  name: [{ name: 'asc' }, { id: 'asc' }],
};

const searchWhere = (q?: string): Prisma.ProductWhereInput =>
  q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { summary: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {};

const inStock = (p: { trackStock: boolean; stock: number }) => !p.trackStock || p.stock > 0;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────── Ziyaretçi ─────────────

  async findPublic(query: PublicProductQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const where: Prisma.ProductWhereInput = {
      AND: [
        VISIBLE,
        query.category ? { category: { slug: query.category } } : {},
        query.featured ? { featured: true } : {},
        searchWhere(query.q),
      ],
    };

    // Yalnızca kart için gereken alanlar seçilir (uzun açıklama, sekmeler yok)
    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: SORTS[query.sort ?? 'new'],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          summary: true,
          price: true,
          compareAtPrice: true,
          currency: true,
          unit: true,
          featured: true,
          trackStock: true,
          stock: true,
          category: { select: { name: true, slug: true } },
          images: { orderBy: { order: 'asc' }, take: 1, select: { url: true, alt: true } },
        },
      }),
    ]);

    return {
      items: products.map(({ images, stock, trackStock, ...p }) => ({
        ...p,
        price: money(p.price),
        compareAtPrice: money(p.compareAtPrice),
        // Kesin stok adedi paylaşılmaz; yalnızca satılabilir mi
        inStock: inStock({ stock, trackStock }),
        image: images[0] ?? null,
      })),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findPublicBySlug(slug: string) {
    const p = await this.prisma.product.findFirst({
      where: { AND: [VISIBLE, { slug }] },
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        summary: true,
        description: true,
        price: true,
        compareAtPrice: true,
        currency: true,
        unit: true,
        featured: true,
        trackStock: true,
        stock: true,
        metaTitle: true,
        metaDescription: true,
        category: { select: { name: true, slug: true } },
        images: { orderBy: { order: 'asc' }, select: { url: true, alt: true } },
        tabs: { orderBy: { order: 'asc' }, select: { title: true, body: true } },
      },
    });
    if (!p) throw new NotFoundException('Ürün bulunamadı.');
    const { stock, trackStock, ...rest } = p;
    return { ...rest, price: money(p.price), compareAtPrice: money(p.compareAtPrice), inStock: inStock({ stock, trackStock }) };
  }

  // ───────────── Admin ─────────────

  async findAll(query: AdminProductQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const statusWhere: Prisma.ProductWhereInput =
      query.status === 'active'
        ? { isActive: true }
        : query.status === 'inactive'
          ? { isActive: false }
          : query.status === 'low-stock'
            ? { trackStock: true, stock: { lt: LOW_STOCK_THRESHOLD } }
            : {};
    const where: Prisma.ProductWhereInput = {
      AND: [NOT_DELETED, searchWhere(query.q), query.category ? { categoryId: query.category } : {}, statusWhere],
    };

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          price: true,
          compareAtPrice: true,
          unit: true,
          stock: true,
          trackStock: true,
          isActive: true,
          featured: true,
          createdAt: true,
          updatedAt: true,
          category: { select: { id: true, name: true } },
          images: { orderBy: { order: 'asc' }, take: 1, select: { url: true, alt: true } },
        },
      }),
    ]);

    return {
      items: products.map(({ images, ...p }) => ({
        ...p,
        price: money(p.price),
        compareAtPrice: money(p.compareAtPrice),
        image: images[0] ?? null,
        lowStock: p.trackStock && p.stock < LOW_STOCK_THRESHOLD,
      })),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findOne(id: string) {
    const p = await this.prisma.product.findFirst({
      where: { id, ...NOT_DELETED },
      include: {
        category: { select: { id: true, name: true } },
        images: { orderBy: { order: 'asc' }, select: { url: true, alt: true } },
        tabs: { orderBy: { order: 'asc' }, select: { title: true, body: true } },
      },
    });
    if (!p) throw new NotFoundException('Ürün bulunamadı.');
    const { deletedAt: _deletedAt, ...rest } = p;
    return { ...rest, price: money(p.price), compareAtPrice: money(p.compareAtPrice) };
  }

  async create(dto: CreateProductDto) {
    if ((await this.prisma.product.count({ where: NOT_DELETED })) >= MAX_PRODUCTS) {
      throw new BadRequestException(`En fazla ${MAX_PRODUCTS} ürün oluşturulabilir.`);
    }
    assertComparePrice(dto.price, dto.compareAtPrice);
    await this.assertCategory(dto.categoryId);

    try {
      const created = await this.prisma.product.create({
        data: {
          name: dto.name.trim(),
          slug: dto.slug,
          sku: dto.sku ?? null,
          summary: dto.summary ?? null,
          description: dto.description ?? null,
          price: dto.price.toFixed(2),
          compareAtPrice: dto.compareAtPrice == null ? null : dto.compareAtPrice.toFixed(2),
          unit: dto.unit ?? null,
          stock: dto.stock ?? 0,
          trackStock: dto.trackStock ?? true,
          isActive: dto.isActive ?? true,
          featured: dto.featured ?? false,
          categoryId: dto.categoryId,
          metaTitle: dto.metaTitle ?? null,
          metaDescription: dto.metaDescription ?? null,
          images: { create: imageRows(dto.images) },
          tabs: { create: tabRows(dto.tabs) },
        },
        select: { id: true },
      });
      return this.findOne(created.id);
    } catch (error) {
      throw mapError(error);
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { id, ...NOT_DELETED },
      select: { price: true, compareAtPrice: true },
    });
    if (!existing) throw new NotFoundException('Ürün bulunamadı.');

    // Yeni değer gelmediyse mevcut değerle karşılaştır
    const price = dto.price ?? Number(existing.price.toFixed(2));
    const compareAtPrice =
      dto.compareAtPrice !== undefined
        ? dto.compareAtPrice
        : existing.compareAtPrice == null
          ? null
          : Number(existing.compareAtPrice.toFixed(2));
    assertComparePrice(price, compareAtPrice);
    if (dto.categoryId !== undefined) await this.assertCategory(dto.categoryId);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id },
          data: {
            name: dto.name?.trim(),
            slug: dto.slug,
            sku: dto.sku,
            summary: dto.summary,
            description: dto.description,
            price: dto.price?.toFixed(2),
            compareAtPrice:
              dto.compareAtPrice === undefined ? undefined : dto.compareAtPrice === null ? null : dto.compareAtPrice.toFixed(2),
            unit: dto.unit,
            stock: dto.stock,
            trackStock: dto.trackStock,
            isActive: dto.isActive,
            featured: dto.featured,
            categoryId: dto.categoryId,
            metaTitle: dto.metaTitle,
            metaDescription: dto.metaDescription,
          },
        });
        if (dto.images) {
          await tx.productImage.deleteMany({ where: { productId: id } });
          await tx.productImage.createMany({ data: imageRows(dto.images).map((row) => ({ ...row, productId: id })) });
        }
        if (dto.tabs) {
          await tx.productTab.deleteMany({ where: { productId: id } });
          await tx.productTab.createMany({ data: tabRows(dto.tabs).map((row) => ({ ...row, productId: id })) });
        }
      });
    } catch (error) {
      throw mapError(error);
    }
    return this.findOne(id);
  }

  /**
   * Soft delete: geçmiş siparişler ürüne bağlı kaldığı için kayıt silinmez.
   * Ürün mağazadan kalkar, sepetlerden çıkarılır; slug/sku yeni ürüne serbest kalır.
   */
  async remove(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, ...NOT_DELETED },
      select: { id: true, slug: true, sku: true },
    });
    if (!product) throw new NotFoundException('Ürün bulunamadı.');
    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
          slug: retiredValue(product.slug, id),
          sku: product.sku ? retiredValue(product.sku, id) : null,
        },
      }),
      this.prisma.cartItem.deleteMany({ where: { productId: id } }),
    ]);
    return { success: true };
  }

  private async assertCategory(categoryId: string) {
    const found = await this.prisma.category.findFirst({ where: { id: categoryId, ...NOT_DELETED }, select: { id: true } });
    if (!found) throw new BadRequestException('Seçilen kategori bulunamadı.');
  }
}

function assertComparePrice(price: number, compareAtPrice: number | null | undefined) {
  if (compareAtPrice != null && compareAtPrice <= price) {
    throw new BadRequestException('Eski fiyat (üstü çizili), satış fiyatından yüksek olmalıdır.');
  }
}

function imageRows(images: ProductImageDto[] = []) {
  return images.map((image, order) => ({ url: image.url, alt: image.alt?.trim() || null, order }));
}

function tabRows(tabs: ProductTabDto[] = []) {
  return tabs.map((tab, order) => ({ title: tab.title.trim(), body: tab.body, order }));
}

function mapError(error: unknown) {
  if (isUniqueViolation(error)) {
    return new ConflictException(
      uniqueViolationFields(error).includes('sku') ? 'Bu stok kodu başka bir üründe kullanılıyor.' : 'Bu adres (slug) başka bir üründe kullanılıyor.',
    );
  }
  return error;
}
