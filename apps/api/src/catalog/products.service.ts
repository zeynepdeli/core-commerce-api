import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { isUniqueViolation, uniqueViolationFields } from '../common/validators.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

import type { AdminProductQueryDto, ProductSort, PublicProductQueryDto } from './dto/catalog-query.dto.js';
import type { CreateProductDto, ProductImageDto, ProductTabDto, ProductVariantDto, UpdateProductDto } from './dto/product.dto.js';
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
  variants: { some: { isActive: true, deletedAt: null } },
};

const LIVE_VARIANT = { isActive: true, deletedAt: null } as const;

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
          { variants: { some: { sku: { contains: q, mode: 'insensitive' }, deletedAt: null } } },
        ],
      }
    : {};

const inStock = (v: { trackStock: boolean; stock: number }) => !v.trackStock || v.stock > 0;

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
          featured: true,
          category: { select: { name: true, slug: true } },
          images: { orderBy: { order: 'asc' }, take: 1, select: { url: true, alt: true } },
          // Yalnızca stok durumu için (adet dışarı verilmez)
          variants: { where: LIVE_VARIANT, select: { stock: true, trackStock: true } },
        },
      }),
    ]);

    return {
      items: products.map(({ images, variants, ...p }) => ({
        ...p,
        // Birden çok varyant varsa bu "…'den başlayan" fiyattır
        price: money(p.price),
        compareAtPrice: money(p.compareAtPrice),
        variantCount: variants.length,
        // Kesin stok adedi paylaşılmaz; yalnızca satılabilir mi
        inStock: variants.some(inStock),
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
        summary: true,
        description: true,
        price: true,
        compareAtPrice: true,
        currency: true,
        vatRate: true,
        featured: true,
        isReturnable: true,
        metaTitle: true,
        metaDescription: true,
        category: { select: { name: true, slug: true } },
        images: { orderBy: { order: 'asc' }, select: { url: true, alt: true } },
        tabs: { orderBy: { order: 'asc' }, select: { title: true, body: true } },
        variants: {
          where: LIVE_VARIANT,
          orderBy: { order: 'asc' },
          select: { id: true, name: true, sku: true, price: true, compareAtPrice: true, stock: true, trackStock: true },
        },
      },
    });
    if (!p) throw new NotFoundException('Ürün bulunamadı.');
    const variants = p.variants.map(({ stock, trackStock, ...v }) => ({
      ...v,
      price: money(v.price),
      compareAtPrice: money(v.compareAtPrice),
      inStock: inStock({ stock, trackStock }),
    }));
    return {
      ...p,
      price: money(p.price),
      compareAtPrice: money(p.compareAtPrice),
      inStock: variants.some((v) => v.inStock),
      variants,
    };
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
            ? { variants: { some: { trackStock: true, stock: { lt: LOW_STOCK_THRESHOLD }, deletedAt: null } } }
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
          price: true,
          compareAtPrice: true,
          vatRate: true,
          isActive: true,
          featured: true,
          createdAt: true,
          updatedAt: true,
          category: { select: { id: true, name: true } },
          images: { orderBy: { order: 'asc' }, take: 1, select: { url: true, alt: true } },
          variants: {
            where: { deletedAt: null },
            orderBy: { order: 'asc' },
            select: { name: true, sku: true, stock: true, trackStock: true, isActive: true },
          },
        },
      }),
    ]);

    return {
      items: products.map(({ images, variants, ...p }) => {
        const tracked = variants.filter((v) => v.trackStock);
        return {
          ...p,
          price: money(p.price),
          compareAtPrice: money(p.compareAtPrice),
          image: images[0] ?? null,
          variantCount: variants.length,
          // Tek varyantlıda o varyantın adı/SKU'su (ör. "500 g", "ANT-500")
          variantName: variants.length === 1 ? variants[0].name : null,
          sku: variants.length === 1 ? variants[0].sku : null,
          // Stok takibi olan varyantların toplam adedi (hiçbiri takip edilmiyorsa null)
          totalStock: tracked.length ? tracked.reduce((sum, v) => sum + v.stock, 0) : null,
          lowStock: tracked.some((v) => v.stock < LOW_STOCK_THRESHOLD),
        };
      }),
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
        variants: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
          select: { id: true, name: true, sku: true, price: true, compareAtPrice: true, stock: true, trackStock: true, isActive: true },
        },
      },
    });
    if (!p) throw new NotFoundException('Ürün bulunamadı.');
    const { deletedAt: _deletedAt, ...rest } = p;
    return {
      ...rest,
      price: money(p.price),
      compareAtPrice: money(p.compareAtPrice),
      variants: p.variants.map((v) => ({ ...v, price: money(v.price), compareAtPrice: money(v.compareAtPrice) })),
    };
  }

  async create(dto: CreateProductDto) {
    if ((await this.prisma.product.count({ where: NOT_DELETED })) >= MAX_PRODUCTS) {
      throw new BadRequestException(`En fazla ${MAX_PRODUCTS} ürün oluşturulabilir.`);
    }
    assertVariants(dto.variants);
    if (dto.variants.some((v) => v.id)) throw new BadRequestException('Yeni üründe varyant kimliği gönderilemez.');
    await this.assertCategory(dto.categoryId);
    const display = displayPrice(dto.variants.map((v) => ({ ...v, isActive: v.isActive ?? true })));

    try {
      const created = await this.prisma.product.create({
        data: {
          name: dto.name.trim(),
          slug: dto.slug,
          summary: dto.summary ?? null,
          description: dto.description ?? null,
          price: display.price,
          compareAtPrice: display.compareAtPrice,
          vatRate: dto.vatRate ?? 20,
          variants: { create: dto.variants.map((v, order) => variantData(v, order)) },
          isActive: dto.isActive ?? true,
          featured: dto.featured ?? false,
          isReturnable: dto.isReturnable ?? true,
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
      select: { id: true, variants: { where: { deletedAt: null }, select: { id: true, sku: true } } },
    });
    if (!existing) throw new NotFoundException('Ürün bulunamadı.');
    if (dto.variants) {
      assertVariants(dto.variants);
      // IDOR koruması: başka bir ürünün varyant kimliği gönderilemez
      const own = new Set(existing.variants.map((v) => v.id));
      if (dto.variants.some((v) => v.id && !own.has(v.id))) {
        throw new BadRequestException('Varyant bu ürüne ait değil.');
      }
    }
    if (dto.categoryId !== undefined) await this.assertCategory(dto.categoryId);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id },
          data: {
            name: dto.name?.trim(),
            slug: dto.slug,
            summary: dto.summary,
            description: dto.description,
            vatRate: dto.vatRate,
            isActive: dto.isActive,
            featured: dto.featured,
            isReturnable: dto.isReturnable,
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
        if (dto.variants) {
          const keep = new Set(dto.variants.flatMap((v) => (v.id ? [v.id] : [])));
          // Listede olmayan varyant: soft delete (geçmiş siparişler korunur), SKU serbest, sepetlerden çıkar.
          // Önce silinir ki aynı SKU'yu yeni bir varyant hemen kullanabilsin.
          for (const old of existing.variants.filter((v) => !keep.has(v.id))) {
            await tx.productVariant.update({
              where: { id: old.id },
              data: { deletedAt: new Date(), isActive: false, sku: old.sku ? retiredValue(old.sku, old.id) : null },
            });
            await tx.cartItem.deleteMany({ where: { variantId: old.id } });
          }
          for (const [order, v] of dto.variants.entries()) {
            if (v.id) await tx.productVariant.update({ where: { id: v.id }, data: variantData(v, order) });
            else await tx.productVariant.create({ data: { ...variantData(v, order), productId: id } });
          }
          const display = displayPrice(dto.variants.map((v) => ({ ...v, isActive: v.isActive ?? true })));
          await tx.product.update({ where: { id }, data: display });
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
      select: { id: true, slug: true, variants: { where: { deletedAt: null }, select: { id: true, sku: true } } },
    });
    if (!product) throw new NotFoundException('Ürün bulunamadı.');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id },
        data: { deletedAt: now, isActive: false, slug: retiredValue(product.slug, id) },
      }),
      ...product.variants.map((v) =>
        this.prisma.productVariant.update({
          where: { id: v.id },
          data: { deletedAt: now, isActive: false, sku: v.sku ? retiredValue(v.sku, v.id) : null },
        }),
      ),
      this.prisma.cartItem.deleteMany({ where: { variant: { productId: id } } }),
    ]);
    return { success: true };
  }

  private async assertCategory(categoryId: string) {
    const found = await this.prisma.category.findFirst({ where: { id: categoryId, ...NOT_DELETED }, select: { id: true } });
    if (!found) throw new BadRequestException('Seçilen kategori bulunamadı.');
  }
}

function assertVariants(variants: ProductVariantDto[]) {
  const names = new Set<string>();
  const skus = new Set<string>();
  for (const v of variants) {
    if (v.compareAtPrice != null && v.compareAtPrice <= v.price) {
      throw new BadRequestException(`"${v.name}": eski fiyat (üstü çizili), satış fiyatından yüksek olmalıdır.`);
    }
    const name = v.name.trim().toLocaleLowerCase('tr');
    if (names.has(name)) throw new BadRequestException(`"${v.name.trim()}" adlı iki varyant olamaz.`);
    names.add(name);
    if (v.sku) {
      if (skus.has(v.sku)) throw new BadRequestException(`"${v.sku}" stok kodu iki varyantta kullanılamaz.`);
      skus.add(v.sku);
    }
  }
  if (!variants.some((v) => v.isActive !== false)) {
    throw new BadRequestException('En az bir varyant satışta olmalıdır (ürünü gizlemek için "Yayında" anahtarını kullanın).');
  }
}

function variantData(v: ProductVariantDto, order: number) {
  return {
    name: v.name.trim(),
    sku: v.sku ?? null,
    price: v.price.toFixed(2),
    compareAtPrice: v.compareAtPrice == null ? null : v.compareAtPrice.toFixed(2),
    stock: v.stock ?? 0,
    trackStock: v.trackStock ?? true,
    isActive: v.isActive ?? true,
    order,
  };
}

/** "…'den başlayan" fiyat: satıştaki en ucuz varyantın fiyatı ve onun eski fiyatı */
export function displayPrice(variants: { price: number; compareAtPrice?: number | null; isActive: boolean }[]) {
  const pool = variants.filter((v) => v.isActive);
  const cheapest = (pool.length ? pool : variants).reduce((a, b) => (b.price < a.price ? b : a));
  return {
    price: cheapest.price.toFixed(2),
    compareAtPrice: cheapest.compareAtPrice == null ? null : cheapest.compareAtPrice.toFixed(2),
  };
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
