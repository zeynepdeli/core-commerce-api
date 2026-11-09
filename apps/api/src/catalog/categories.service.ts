import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { assertSameIds } from '../common/reorder.js';
import { isUniqueViolation, uniqueViolationFields } from '../common/validators.js';
import { PrismaService } from '../prisma/prisma.service.js';

import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import { retiredValue } from './soft-delete.js';

// Kaynak tüketimini sınırla (OWASP API4)
export const MAX_CATEGORIES = 200;

const PUBLIC_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  image: true,
  metaTitle: true,
  metaDescription: true,
} as const;

const NOT_DELETED = { deletedAt: null } as const;
const VISIBLE_PRODUCTS = { isActive: true, deletedAt: null } as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ziyaretçi: yayındaki kategoriler ve içlerindeki yayındaki ürün sayısı */
  async findPublic() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true, ...NOT_DELETED },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: { ...PUBLIC_SELECT, _count: { select: { products: { where: VISIBLE_PRODUCTS } } } },
    });
    return categories.map(({ _count, ...category }) => ({ ...category, productCount: _count.products }));
  }

  async findPublicBySlug(slug: string) {
    const category = await this.prisma.category.findFirst({
      where: { slug, isActive: true, ...NOT_DELETED },
      select: PUBLIC_SELECT,
    });
    if (!category) throw new NotFoundException('Kategori bulunamadı.');
    return category;
  }

  async findAll() {
    const categories = await this.prisma.category.findMany({
      where: NOT_DELETED,
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: { where: NOT_DELETED } } } },
    });
    return categories.map(({ _count, deletedAt: _deletedAt, ...category }) => ({
      ...category,
      productCount: _count.products,
    }));
  }

  async create(dto: CreateCategoryDto) {
    const count = await this.prisma.category.count({ where: NOT_DELETED });
    if (count >= MAX_CATEGORIES) throw new BadRequestException(`En fazla ${MAX_CATEGORIES} kategori oluşturulabilir.`);
    try {
      return await this.prisma.category.create({
        data: {
          name: dto.name.trim(),
          slug: dto.slug,
          description: dto.description ?? null,
          image: dto.image ?? null,
          isActive: dto.isActive ?? true,
          metaTitle: dto.metaTitle ?? null,
          metaDescription: dto.metaDescription ?? null,
          order: count,
        },
      });
    } catch (error) {
      throw mapError(error);
    }
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.ensureExists(id);
    try {
      return await this.prisma.category.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          slug: dto.slug,
          description: dto.description,
          image: dto.image,
          isActive: dto.isActive,
          metaTitle: dto.metaTitle,
          metaDescription: dto.metaDescription,
        },
      });
    } catch (error) {
      throw mapError(error);
    }
  }

  /** İçinde (silinmemiş) ürün olan kategori silinmez: ürünler kategorisiz kalmasın */
  async remove(id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, ...NOT_DELETED },
      select: { id: true, name: true, slug: true, _count: { select: { products: { where: NOT_DELETED } } } },
    });
    if (!category) throw new NotFoundException('Kategori bulunamadı.');
    if (category._count.products > 0) {
      throw new ConflictException(
        `Bu kategoride ${category._count.products} ürün var. Önce ürünleri başka bir kategoriye taşıyın veya silin.`,
      );
    }
    await this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, name: retiredValue(category.name, id), slug: retiredValue(category.slug, id) },
    });
    return { success: true };
  }

  async reorder(ids: string[]) {
    const existing = await this.prisma.category.findMany({ where: NOT_DELETED, select: { id: true } });
    assertSameIds(existing.map((c) => c.id), ids);
    await this.prisma.$transaction(ids.map((id, index) => this.prisma.category.update({ where: { id }, data: { order: index } })));
    return this.findAll();
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.category.findFirst({ where: { id, ...NOT_DELETED }, select: { id: true } });
    if (!found) throw new NotFoundException('Kategori bulunamadı.');
  }
}

function mapError(error: unknown) {
  if (isUniqueViolation(error)) {
    return new ConflictException(
      uniqueViolationFields(error).includes('name') ? 'Bu adda bir kategori zaten var.' : 'Bu adres (slug) başka bir kategoride kullanılıyor.',
    );
  }
  return error;
}
