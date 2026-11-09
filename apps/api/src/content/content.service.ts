import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import { fromKurus, toKurus } from '../commerce/money.js';
import { assertSameIds } from '../common/reorder.js';
import { isUniqueViolation } from '../common/validators.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { type BlockData, type ProductListBlockDto, SOCIAL_HOSTS, type SaveBlockDto, type SaveFaqDto, type SavePageDto, type UpdateSiteDto } from './content.dto.js';

const HOME = 'home';
const CACHE_MS = 60_000;
const MAX_BLOCKS = 30;
const VISIBLE_PRODUCT: Prisma.ProductWhereInput = {
  isActive: true,
  deletedAt: null,
  category: { isActive: true, deletedAt: null },
  variants: { some: { isActive: true, deletedAt: null } },
};
const CARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  summary: true,
  price: true,
  compareAtPrice: true,
  ratingAvg: true,
  ratingCount: true,
  images: { orderBy: { order: 'asc' }, take: 1, select: { url: true, alt: true } },
  variants: { where: { isActive: true, deletedAt: null }, select: { stock: true, trackStock: true } },
} satisfies Prisma.ProductSelect;
type CardRow = Prisma.ProductGetPayload<{ select: typeof CARD_SELECT }>;

/** Mağaza ürün kartı (katalog listesiyle aynı biçim) */
const card = (p: CardRow) => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  summary: p.summary,
  price: fromKurus(toKurus(p.price)),
  compareAtPrice: p.compareAtPrice ? fromKurus(toKurus(p.compareAtPrice)) : null,
  rating: p.ratingCount ? { average: Number(p.ratingAvg), count: p.ratingCount } : null,
  image: p.images[0] ?? null,
  variantCount: p.variants.length,
  inStock: p.variants.some((v) => !v.trackStock || v.stock > 0),
});

/** Görsel adreslerini bölüm verisinden topla (medya "kullanımda" denetimi için) */
export function blockImageUrls(data: unknown): string[] {
  const d = data as { slides?: { imageUrl?: string; mobileImageUrl?: string }[]; imageUrl?: string; mobileImageUrl?: string };
  return [...(d.slides ?? []).flatMap((s) => [s.imageUrl, s.mobileImageUrl]), d.imageUrl, d.mobileImageUrl].filter((u): u is string => typeof u === 'string' && u.length > 0);
}

/**
 * Mağaza içeriği: görünüm, ana sayfa bölümleri, bilgi sayfaları, S.S.S.
 * Mağaza (headless) tek uçtan okur; yanıtlar 60 sn önbellekte, yönetici değiştirince temizlenir.
 */
@Injectable()
export class ContentService {
  private cache = new Map<string, { at: number; value: unknown }>();

  constructor(private readonly prisma: PrismaService) {}

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T;
    const value = await load();
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  invalidate() {
    this.cache.clear();
  }

  // ───────────── Görünüm ─────────────

  private async theme() {
    return (await this.prisma.siteTheme.findUnique({ where: { id: 1 } })) ?? this.prisma.siteTheme.create({ data: { id: 1 } });
  }

  async adminSite() {
    const { id: _id, updatedAt: _u, ...t } = await this.theme();
    return t;
  }

  async updateSite(dto: UpdateSiteDto) {
    const { socialLinks, ...rest } = dto;
    let social: Record<string, string> | undefined;
    if (socialLinks !== undefined) {
      if (typeof socialLinks !== 'object' || socialLinks === null || Array.isArray(socialLinks)) throw new BadRequestException('Sosyal medya bağlantıları geçersiz.');
      social = {};
      for (const [network, value] of Object.entries(socialLinks)) {
        if (!(network in SOCIAL_HOSTS)) throw new BadRequestException(`Bilinmeyen sosyal ağ: ${network.slice(0, 20)}`);
        if (value === '' || value === null) continue;
        let url: URL;
        try {
          url = new URL(String(value));
        } catch {
          throw new BadRequestException(`${network} bağlantısı geçersiz.`);
        }
        if (url.protocol !== 'https:' || url.username || url.password || !SOCIAL_HOSTS[network].includes(url.hostname) || String(value).length > 300) {
          throw new BadRequestException(`${network} bağlantısı https://${SOCIAL_HOSTS[network][0]}/… biçiminde olmalı.`);
        }
        social[network] = url.toString();
      }
    }
    const data = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v === '' ? null : v])) as Prisma.SiteThemeUpdateInput;
    await this.theme();
    await this.prisma.siteTheme.update({ where: { id: 1 }, data: { ...data, ...(social ? { socialLinks: social } : {}) } });
    this.invalidate();
    return this.adminSite();
  }

  /** Mağazanın her sayfada ihtiyaç duyduğu her şey (tek istek) */
  site() {
    return this.cached('site', async () => {
      const [t, pages] = await Promise.all([
        this.theme(),
        this.prisma.page.findMany({ where: { isPublished: true, showInFooter: true }, orderBy: [{ order: 'asc' }, { title: 'asc' }], select: { slug: true, title: true } }),
      ]);
      return {
        name: t.siteName,
        theme: {
          primaryColor: t.primaryColor,
          secondaryColor: t.secondaryColor,
          backgroundColor: t.backgroundColor,
          textColor: t.textColor,
          fontHeading: t.fontHeading,
          fontBody: t.fontBody,
          backgroundImageUrl: t.backgroundImageUrl,
          backgroundImageFit: t.backgroundImageFit,
          cardTextureUrl: t.cardTextureUrl,
        },
        logoUrl: t.logoUrl,
        faviconUrl: t.faviconUrl,
        announcement: t.announcementText ? { text: t.announcementText, link: t.announcementLink } : null,
        contact: { email: t.contactEmail, phone: t.contactPhone, whatsapp: t.contactWhatsapp, address: t.contactAddress, workingHours: t.workingHours },
        social: t.socialLinks,
        seo: { title: t.metaTitle ?? t.siteName, description: t.metaDescription, ogImageUrl: t.ogImageUrl },
        footerPages: pages,
      };
    });
  }

  // ───────────── Ana sayfa ─────────────

  async adminBlocks() {
    return this.prisma.contentBlock.findMany({ where: { page: HOME }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
  }

  async adminBlock(id: string) {
    const b = await this.prisma.contentBlock.findFirst({ where: { id, page: HOME } });
    if (!b) throw new NotFoundException('Bölüm bulunamadı.');
    return b;
  }

  private async assertRefs(data: BlockData) {
    if (data.type === 'PRODUCT_LIST' && data.source === 'category' && data.categoryId) {
      if (!(await this.prisma.category.count({ where: { id: data.categoryId, deletedAt: null } }))) throw new BadRequestException('Kategori bulunamadı.');
    }
    if (data.visibleFrom && data.visibleUntil && Date.parse(data.visibleFrom) >= Date.parse(data.visibleUntil)) {
      throw new BadRequestException('Yayın bitişi başlangıçtan sonra olmalı.');
    }
  }

  async createBlock(dto: SaveBlockDto) {
    await this.assertRefs(dto.data);
    const count = await this.prisma.contentBlock.count({ where: { page: HOME } });
    if (count >= MAX_BLOCKS) throw new BadRequestException(`Ana sayfada en fazla ${MAX_BLOCKS} bölüm olabilir.`);
    try {
      const b = await this.prisma.contentBlock.create({
        data: {
          page: HOME,
          key: dto.key ?? `${dto.data.type.toLowerCase().replace('_', '-')}-${randomBytes(3).toString('hex')}`,
          data: dto.data as unknown as Prisma.InputJsonValue,
          order: count,
          isActive: dto.isActive ?? true,
        },
      });
      this.invalidate();
      return b;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Bu anahtarla bir bölüm zaten var.');
      throw error;
    }
  }

  async updateBlock(id: string, dto: SaveBlockDto) {
    const existing = await this.adminBlock(id);
    if ((existing.data as { type?: string }).type !== dto.data.type) throw new BadRequestException('Bölüm türü değiştirilemez; yeni bölüm ekleyin.');
    await this.assertRefs(dto.data);
    try {
      const b = await this.prisma.contentBlock.update({
        where: { id },
        data: { data: dto.data as unknown as Prisma.InputJsonValue, ...(dto.key ? { key: dto.key } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) },
      });
      this.invalidate();
      return b;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Bu anahtarla bir bölüm zaten var.');
      throw error;
    }
  }

  async setBlockActive(id: string, isActive: boolean) {
    await this.adminBlock(id);
    await this.prisma.contentBlock.update({ where: { id }, data: { isActive } });
    this.invalidate();
    return { id, isActive };
  }

  async deleteBlock(id: string) {
    await this.adminBlock(id);
    await this.prisma.contentBlock.delete({ where: { id } });
    this.invalidate();
    return { success: true };
  }

  async reorderBlocks(ids: string[]) {
    const existing = await this.prisma.contentBlock.findMany({ where: { page: HOME }, select: { id: true } });
    assertSameIds(
      existing.map((e) => e.id),
      ids,
    );
    await this.prisma.$transaction(ids.map((id, order) => this.prisma.contentBlock.update({ where: { id }, data: { order } })));
    this.invalidate();
    return this.adminBlocks();
  }

  /** Mağaza ana sayfası: aktif, yayın zamanı gelmiş bölümler; ürün ve kategoriler çözümlenmiş */
  home() {
    return this.cached('home', async () => {
      const now = Date.now();
      const blocks = await this.prisma.contentBlock.findMany({ where: { page: HOME, isActive: true }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
      const visible = blocks.filter((b) => {
        const d = b.data as { visibleFrom?: string | null; visibleUntil?: string | null };
        return (!d.visibleFrom || Date.parse(d.visibleFrom) <= now) && (!d.visibleUntil || Date.parse(d.visibleUntil) > now);
      });
      const sections = await Promise.all(
        visible.map(async (b) => {
          const d = b.data as unknown as BlockData;
          const { visibleFrom: _f, visibleUntil: _u, ...data } = d;
          if (d.type === 'PRODUCT_LIST') return { key: b.key, ...data, products: await this.products(d) };
          if (d.type === 'CATEGORY_GRID') {
            const ids = d.categoryIds ?? [];
            const rows = await this.prisma.category.findMany({
              where: { isActive: true, deletedAt: null, ...(ids.length ? { id: { in: ids } } : { parentId: null }) },
              select: { id: true, name: true, slug: true, image: true },
              orderBy: [{ order: 'asc' }, { name: 'asc' }],
              take: 12,
            });
            // Seçilen sıra korunur
            const categories = ids.length ? ids.map((id) => rows.find((r) => r.id === id)).filter((r) => !!r) : rows;
            return { key: b.key, ...data, categories };
          }
          return { key: b.key, ...data };
        }),
      );
      // Ürünü kalmamış liste gösterilmez
      return { sections: sections.filter((s) => !('products' in s) || (s.products as unknown[]).length > 0) };
    });
  }

  private async products(d: ProductListBlockDto) {
    const take = d.limit;
    if (d.source === 'manual') {
      const rows = await this.prisma.product.findMany({ where: { ...VISIBLE_PRODUCT, id: { in: d.productIds ?? [] } }, select: CARD_SELECT });
      return (d.productIds ?? []).map((id) => rows.find((r) => r.id === id)).filter((r): r is CardRow => !!r).slice(0, take).map(card);
    }
    if (d.source === 'bestsellers') {
      const since = new Date(Date.now() - 30 * 86_400_000);
      const top = await this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { paidAt: { gte: since }, status: { notIn: ['CANCELLED', 'REFUNDED'] } }, product: VISIBLE_PRODUCT },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take,
      });
      const rows = await this.prisma.product.findMany({ where: { id: { in: top.map((t) => t.productId) } }, select: CARD_SELECT });
      const ordered = top.map((t) => rows.find((r) => r.id === t.productId)).filter((r): r is CardRow => !!r);
      // Yeterli satış yoksa yeni ürünlerle tamamlanır
      if (ordered.length < take) {
        const extra = await this.prisma.product.findMany({ where: { ...VISIBLE_PRODUCT, id: { notIn: ordered.map((o) => o.id) } }, orderBy: { createdAt: 'desc' }, take: take - ordered.length, select: CARD_SELECT });
        ordered.push(...extra);
      }
      return ordered.map(card);
    }
    const where: Prisma.ProductWhereInput = { ...VISIBLE_PRODUCT, ...(d.source === 'featured' ? { featured: true } : {}), ...(d.source === 'category' ? { categoryId: d.categoryId } : {}) };
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = d.source === 'rating' ? [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }] : [{ createdAt: 'desc' }];
    const rows = await this.prisma.product.findMany({ where, orderBy: [...orderBy, { id: 'asc' }], take, select: CARD_SELECT });
    return rows.map(card);
  }

  // ───────────── Sayfalar ─────────────

  adminPages() {
    return this.prisma.page.findMany({ orderBy: [{ order: 'asc' }, { title: 'asc' }], select: { id: true, slug: true, title: true, isPublished: true, showInFooter: true, order: true, updatedAt: true } });
  }

  async adminPage(id: string) {
    const p = await this.prisma.page.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Sayfa bulunamadı.');
    return p;
  }

  async savePage(id: string | null, dto: SavePageDto) {
    const data = {
      title: dto.title,
      slug: dto.slug,
      body: dto.body,
      metaTitle: dto.metaTitle || null,
      metaDescription: dto.metaDescription || null,
      isPublished: dto.isPublished ?? true,
      showInFooter: dto.showInFooter ?? true,
    };
    try {
      const page = id ? await this.prisma.page.update({ where: { id }, data }) : await this.prisma.page.create({ data: { ...data, order: await this.prisma.page.count() } });
      this.invalidate();
      return page;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Bu adres (slug) başka bir sayfada kullanılıyor.');
      if ((error as { code?: string }).code === 'P2025') throw new NotFoundException('Sayfa bulunamadı.');
      throw error;
    }
  }

  async deletePage(id: string) {
    const { count } = await this.prisma.page.deleteMany({ where: { id } });
    if (!count) throw new NotFoundException('Sayfa bulunamadı.');
    this.invalidate();
    return { success: true };
  }

  async reorderPages(ids: string[]) {
    const existing = await this.prisma.page.findMany({ select: { id: true } });
    assertSameIds(
      existing.map((e) => e.id),
      ids,
    );
    await this.prisma.$transaction(ids.map((id, order) => this.prisma.page.update({ where: { id }, data: { order } })));
    this.invalidate();
    return this.adminPages();
  }

  async page(slug: string) {
    const p = await this.prisma.page.findFirst({ where: { slug, isPublished: true }, select: { slug: true, title: true, body: true, metaTitle: true, metaDescription: true, updatedAt: true } });
    if (!p) throw new NotFoundException('Sayfa bulunamadı.');
    return p;
  }

  // ───────────── S.S.S. ─────────────

  adminFaq() {
    return this.prisma.faqItem.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
  }

  async saveFaq(id: string | null, dto: SaveFaqDto) {
    const data = { question: dto.question, answer: dto.answer, category: dto.category || null, isActive: dto.isActive ?? true };
    try {
      const item = id ? await this.prisma.faqItem.update({ where: { id }, data }) : await this.prisma.faqItem.create({ data: { ...data, order: await this.prisma.faqItem.count() } });
      this.invalidate();
      return item;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2025') throw new NotFoundException('Soru bulunamadı.');
      throw error;
    }
  }

  async deleteFaq(id: string) {
    const { count } = await this.prisma.faqItem.deleteMany({ where: { id } });
    if (!count) throw new NotFoundException('Soru bulunamadı.');
    this.invalidate();
    return { success: true };
  }

  async reorderFaq(ids: string[]) {
    const existing = await this.prisma.faqItem.findMany({ select: { id: true } });
    assertSameIds(
      existing.map((e) => e.id),
      ids,
    );
    await this.prisma.$transaction(ids.map((id, order) => this.prisma.faqItem.update({ where: { id }, data: { order } })));
    this.invalidate();
    return this.adminFaq();
  }

  /** Kategorilere göre gruplanmış (mağaza FAQPage yapısal verisini buradan üretebilir) */
  faq() {
    return this.cached('faq', async () => {
      const items = await this.prisma.faqItem.findMany({ where: { isActive: true }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }], select: { id: true, question: true, answer: true, category: true } });
      const groups = new Map<string, { id: string; question: string; answer: string }[]>();
      for (const { category, ...item } of items) {
        const key = category ?? '';
        groups.set(key, [...(groups.get(key) ?? []), item]);
      }
      return { groups: [...groups.entries()].map(([category, list]) => ({ category: category || null, items: list })) };
    });
  }
}
