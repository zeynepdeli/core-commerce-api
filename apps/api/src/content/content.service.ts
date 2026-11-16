import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import { fromKurus, toKurus } from '../commerce/money.js';
import { assertSameIds } from '../common/reorder.js';
import { isUniqueViolation } from '../common/validators.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { maskName } from '../reviews/reviews.service.js';

import { type BlockData, type ProductListBlockDto, type SaveBlockDto, type SaveCampaignDto, type SaveFaqDto, type SavePageDto, type UpdateAboutDto, type UpdateFooterDto, type UpdateSiteDto } from './content.dto.js';
import { hasAboutContent } from './about.js';
import { parseCampaignPage, parseContactPage, parseFaqPage } from './page-settings.js';
import { normalizeFooterLink, parseFooterLinks } from './footer-links.js';
import { parseHeaderLinks } from './header-links.js';
import { mergeSiteImages, parseSiteImages } from './site-images.js';

/** Gönderilmeyen alanı atla, boş metni null yap (formda temizlenen alan varsayılana döner) */
const blankToNull = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, v === '' ? null : v]));

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

/** Elle girilen kartlar mağazaya: fiyat iki haneli metin ("149.90"), tükendi → inStock:false */
export const customCards = (cards: ProductListBlockDto['cards']) =>
  (cards ?? []).map((c) => ({
    name: c.name,
    image: { url: c.imageUrl, alt: null },
    price: c.price ? Number(c.price).toFixed(2) : null,
    compareAtPrice: c.compareAtPrice ? Number(c.compareAtPrice).toFixed(2) : null,
    link: c.link ?? null,
    inStock: !c.soldOut,
  }));

/**
 * Kaydedilecek bölüm verisi. Ürün listesinde yalnızca seçili kaynağın alanı saklanır:
 * kaynak "elle kartlar" değilse kartlar (doğrulanmadan gelmiş olabilir) atılır; "elle seçilen ürünler"
 * değilse ürün seçimi. Kartlardan yalnızca bilinen alanlar yazılır.
 */
export function storedBlock(data: BlockData): Prisma.InputJsonValue {
  if (data.type !== 'PRODUCT_LIST') return data as unknown as Prisma.InputJsonValue;
  const { cards, productIds, ...rest } = data;
  return {
    ...rest,
    ...(data.source === 'custom'
      ? { cards: (cards ?? []).map(({ name, imageUrl, price, compareAtPrice, link, soldOut }) => ({ name, imageUrl, price, compareAtPrice, link, soldOut })) }
      : {}),
    ...(data.source === 'manual' ? { productIds } : {}),
  } as unknown as Prisma.InputJsonValue;
}

/** Görsel adreslerini bölüm verisinden topla (medya "kullanımda" denetimi için) */
export function blockImageUrls(data: unknown): string[] {
  const d = data as {
    slides?: { imageUrl?: string; mobileImageUrl?: string }[];
    cards?: { imageUrl?: string; productImage?: string; userImage?: string }[];
    imageUrl?: string;
    mobileImageUrl?: string;
    desktopBackground?: string;
    mobileBackground?: string;
    backgroundImage?: string;
    frameImage?: string;
    cardTexture?: string;
    videoUrl?: string;
  };
  return [
    ...(d.slides ?? []).flatMap((s) => [s.imageUrl, s.mobileImageUrl]),
    // Elle girilen ürün kartları (imageUrl) ve müşteri yorumu kartları (productImage, userImage)
    ...(d.cards ?? []).flatMap((c) => [c.imageUrl, c.productImage, c.userImage]),
    d.imageUrl,
    d.mobileImageUrl,
    d.desktopBackground,
    d.mobileBackground,
    d.backgroundImage,
    d.frameImage,
    d.cardTexture,
    // Kategoriler bölümündeki kapı videosu (medya kütüphanesinden ise silinemesin)
    d.videoUrl,
  ].filter((u): u is string => typeof u === 'string' && u.length > 0);
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
    const { id: _id, updatedAt: _u, headerLinks, siteImages, contactPage, faqPage, campaignPage, ...t } = await this.theme();
    return {
      ...t,
      headerLinks: parseHeaderLinks(headerLinks),
      siteImages: parseSiteImages(siteImages),
      contactPage: parseContactPage(contactPage),
      faqPage: parseFaqPage(faqPage),
      campaignPage: parseCampaignPage(campaignPage),
    };
  }

  async updateSite(dto: UpdateSiteDto) {
    const { headerLinks, siteImages, contactPage, faqPage, campaignPage, ...rest } = dto;
    const current = await this.theme();
    const data = {
      ...Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v === '' ? null : v])),
      // Yalnızca doğrulanmış iki alan yazılır (DTO örneğinin başka özelliği JSON'a girmez)
      ...(headerLinks ? { headerLinks: headerLinks.map(({ label, href }) => ({ label, href })) } : {}),
      // Gönderilen görseller mevcutların üstüne işlenir; izinli liste dışı ad yazılamaz
      ...(siteImages ? { siteImages: mergeSiteImages(current.siteImages, siteImages) } : {}),
      // Gönderilen alanlar mevcut ayarın üstüne yazılır (boş görsel/bağlantı = varsayılan); okurken yeniden doğrulanır
      ...(contactPage ? { contactPage: { ...parseContactPage(current.contactPage), ...contactPage } as Prisma.InputJsonValue } : {}),
      ...(faqPage ? { faqPage: { ...parseFaqPage(current.faqPage), ...faqPage } as Prisma.InputJsonValue } : {}),
      ...(campaignPage ? { campaignPage: { ...parseCampaignPage(current.campaignPage), ...campaignPage } as Prisma.InputJsonValue } : {}),
    } as Prisma.SiteThemeUpdateInput;
    await this.prisma.siteTheme.update({ where: { id: 1 }, data });
    this.invalidate();
    return this.adminSite();
  }

  // ───────────── Hakkımızda ─────────────

  private async about() {
    return (await this.prisma.aboutPage.findUnique({ where: { id: 1 } })) ?? this.prisma.aboutPage.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  }

  async adminAbout() {
    const { id: _id, updatedAt: _u, ...about } = await this.about();
    return about;
  }

  async updateAbout(dto: UpdateAboutDto) {
    await this.about();
    const { isPublished, ...rest } = dto;
    await this.prisma.aboutPage.update({ where: { id: 1 }, data: { ...blankToNull(rest), ...(isPublished === undefined ? {} : { isPublished }) } as Prisma.AboutPageUpdateInput });
    return this.adminAbout();
  }

  /** Mağaza: yayında değilse ya da hiç içerik girilmemişse 404 (boş sayfa yayınlanmaz) */
  async publicAbout() {
    const { id: _id, isPublished, updatedAt: _u, ...about } = await this.about();
    if (!isPublished || !hasAboutContent(about)) throw new NotFoundException('Sayfa bulunamadı.');
    return about;
  }

  // ───────────── Alt bilgi (footer) ─────────────

  private async footer() {
    return (await this.prisma.siteFooter.findUnique({ where: { id: 1 } })) ?? this.prisma.siteFooter.create({ data: { id: 1 } });
  }

  async adminFooter() {
    const [{ id: _id, updatedAt: _u, socialLinks, ...footer }, t, pages] = await Promise.all([
      this.footer(),
      this.theme(),
      this.prisma.page.findMany({
        orderBy: [{ order: 'asc' }, { title: 'asc' }],
        select: { id: true, title: true, slug: true, isPublished: true, showInFooter: true },
      }),
    ]);
    return {
      ...footer,
      socialLinks: parseFooterLinks(socialLinks),
      contactEmail: t.contactEmail,
      contactPhone: t.contactPhone,
      contactWhatsapp: t.contactWhatsapp,
      contactAddress: t.contactAddress,
      workingHours: t.workingHours,
      pages,
    };
  }

  async updateFooter(dto: UpdateFooterDto) {
    const { socialLinks, footerPageIds, contactEmail, contactPhone, contactWhatsapp, contactAddress, workingHours, ...rest } = dto;
    const links = socialLinks?.map(normalizeFooterLink);
    if (footerPageIds?.length && (await this.prisma.page.count({ where: { id: { in: footerPageIds } } })) !== footerPageIds.length) {
      throw new BadRequestException('Sayfa bulunamadı.');
    }

    const footerData = { ...blankToNull(rest), ...(links ? { socialLinks: links } : {}) } as Prisma.SiteFooterUpdateInput;
    const contactData = blankToNull({ contactEmail, contactPhone, contactWhatsapp, contactAddress, workingHours }) as Prisma.SiteThemeUpdateInput;

    await Promise.all([this.footer(), this.theme()]);
    // Tek işlem: biri başarısız olursa hiçbiri yazılmaz (yarım kaydedilmiş footer olmaz)
    await this.prisma.$transaction([
      this.prisma.siteFooter.update({ where: { id: 1 }, data: footerData }),
      this.prisma.siteTheme.update({ where: { id: 1 }, data: contactData }),
      ...(footerPageIds
        ? [
            this.prisma.page.updateMany({ where: { id: { in: footerPageIds } }, data: { showInFooter: true } }),
            this.prisma.page.updateMany({ where: { id: { notIn: footerPageIds } }, data: { showInFooter: false } }),
          ]
        : []),
    ]);
    this.invalidate();
    return this.adminFooter();
  }

  /** Mağazanın her sayfada ihtiyaç duyduğu her şey (tek istek) */
  site() {
    return this.cached('site', async () => {
      const [t, f, pages] = await Promise.all([
        this.theme(),
        this.footer(),
        this.prisma.page.findMany({ where: { isPublished: true, showInFooter: true }, orderBy: [{ order: 'asc' }, { title: 'asc' }], select: { slug: true, title: true } }),
      ]);
      const social = parseFooterLinks(f.socialLinks);
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
        headerLinks: parseHeaderLinks(t.headerLinks),
        header: {
          delivery: t.showDelivery ? { title: t.deliveryTitle, text: t.deliveryText, link: t.deliveryLink, iconUrl: t.deliveryIconUrl } : null,
          searchPlaceholder: t.searchPlaceholder,
          loginText: t.loginText,
          accountText: t.accountText,
          cartText: t.cartText,
        },
        productPage: { labelText: t.productLabelText, addToCartText: t.addToCartText, buyNowText: t.buyNowText, quantityText: t.quantityText },
        contactPage: parseContactPage(t.contactPage),
        faqPage: parseFaqPage(t.faqPage),
        campaignPage: parseCampaignPage(t.campaignPage),
        siteImages: parseSiteImages(t.siteImages),
        contact: { email: t.contactEmail, phone: t.contactPhone, whatsapp: t.contactWhatsapp, address: t.contactAddress, workingHours: t.workingHours },
        seo: { title: t.metaTitle ?? t.siteName, description: t.metaDescription, ogImageUrl: t.ogImageUrl },
        footerPages: pages,
        footer: {
          description: f.description,
          social,
          pagesTitle: f.pagesTitle,
          contactTitle: f.contactTitle,
          campaign: f.showCampaign
            ? { title: f.campaignTitle, text: f.campaignText, buttonLabel: f.campaignButtonLabel, buttonLink: f.campaignButtonLink }
            : null,
          copyright: f.copyrightText,
        },
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
          data: storedBlock(dto.data),
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
        data: { data: storedBlock(dto.data), ...(dto.key ? { key: dto.key } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) },
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
          if (d.type === 'PRODUCT_LIST' && d.source === 'custom') return { key: b.key, ...data, cards: customCards(d.cards) };
          if (d.type === 'PRODUCT_LIST') return { key: b.key, ...data, products: await this.products(d) };
          if (d.type === 'CATEGORY_GRID') {
            const ids = d.categoryIds ?? [];
            const rows = await this.prisma.category.findMany({
              // Kategori seçilmediyse tüm aktif kategoriler (önceki sürümdeki parentId koşulu şemada yoktu: sorgu hata veriyordu)
              where: { isActive: true, deletedAt: null, ...(ids.length ? { id: { in: ids } } : {}) },
              select: { id: true, name: true, slug: true, image: true },
              orderBy: [{ order: 'asc' }, { name: 'asc' }],
              take: 12,
            });
            // Seçilen sıra korunur
            const categories = ids.length ? ids.map((id) => rows.find((r) => r.id === id)).filter((r) => !!r) : rows;
            return { key: b.key, ...data, categories };
          }
          if (d.type === 'REVIEWS') {
            // Elle girilen yorumlar önce, sonra (seçildiyse) sitedeki onaylı yorumlar
            const approved = d.includeApproved ? await this.approvedReviewCards(d.approvedLimit ?? 6) : [];
            return { key: b.key, ...data, cards: [...d.cards, ...approved] };
          }
          return { key: b.key, ...data };
        }),
      );
      // Ürünü / kartı kalmamış liste gösterilmez
      return {
        sections: sections.filter((s) => (!('products' in s) || (s.products as unknown[]).length > 0) && (!('cards' in s) || (s.cards as unknown[]).length > 0)),
      };
    });
  }

  /**
   * Ana sayfa yorum kartı için sitedeki onaylı ürün yorumları: 4–5 yıldız, yorumu olan, yayındaki ürünler,
   * en yeniler. Müşterinin adı kısaltılır ("Ayşe Y."; kişisel veri en aza), müşteri fotoğrafı yok.
   * Ürün görseli olmayan yorum kartın arka planı olamayacağı için atlanır.
   */
  private async approvedReviewCards(limit: number) {
    const rows = await this.prisma.review.findMany({
      where: { status: 'APPROVED', rating: { gte: 4 }, comment: { not: '' }, user: { deletedAt: null }, product: { ...VISIBLE_PRODUCT, images: { some: {} } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: limit,
      select: {
        rating: true,
        comment: true,
        user: { select: { name: true } },
        product: { select: { images: { orderBy: { order: 'asc' }, take: 1, select: { url: true } } } },
      },
    });
    return rows.flatMap((r) => {
      const image = r.product.images[0]?.url;
      if (!image) return [];
      // Kart en fazla 300 karakter gösterir (elle girilenle aynı sınır)
      const comment = r.comment.trim().length > 300 ? `${r.comment.trim().slice(0, 297)}…` : r.comment.trim();
      return [{ name: maskName(r.user.name), rating: r.rating, comment, productImage: image, userImage: null }];
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
    // Hiç ürün "öne çıkan" işaretli değilse bölüm boş kalmasın: en yeni ürünler (çok satanlardaki gibi)
    if (d.source === 'featured' && rows.length === 0) {
      return (await this.prisma.product.findMany({ where: VISIBLE_PRODUCT, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take, select: CARD_SELECT })).map(card);
    }
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

  // ───────────── Kampanyalar ─────────────

  adminCampaigns() {
    return this.prisma.campaign.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
  }

  async saveCampaign(id: string | null, dto: SaveCampaignDto) {
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (startsAt && endsAt && startsAt >= endsAt) throw new BadRequestException('Bitiş tarihi başlangıçtan sonra olmalı.');
    const data = {
      title: dto.title,
      description: dto.description || null,
      badge: dto.badge || null,
      imageUrl: dto.imageUrl || null,
      couponCode: dto.couponCode || null,
      linkUrl: dto.linkUrl || null,
      linkLabel: dto.linkLabel || null,
      startsAt,
      endsAt,
      ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
    };
    if (id) {
      const { count } = await this.prisma.campaign.updateMany({ where: { id }, data });
      if (!count) throw new NotFoundException('Kampanya bulunamadı.');
    } else {
      await this.prisma.campaign.create({ data: { ...data, order: await this.prisma.campaign.count() } });
    }
    this.invalidate();
    return this.adminCampaigns();
  }

  async deleteCampaign(id: string) {
    const { count } = await this.prisma.campaign.deleteMany({ where: { id } });
    if (!count) throw new NotFoundException('Kampanya bulunamadı.');
    this.invalidate();
    return this.adminCampaigns();
  }

  async reorderCampaigns(ids: string[]) {
    const existing = await this.prisma.campaign.findMany({ select: { id: true } });
    if (ids.length !== existing.length || new Set(ids).size !== ids.length || !existing.every((e) => ids.includes(e.id))) {
      throw new BadRequestException('Sıralama listesi güncel değil; sayfayı yenileyin.');
    }
    await this.prisma.$transaction(ids.map((id, order) => this.prisma.campaign.update({ where: { id }, data: { order } })));
    this.invalidate();
    return this.adminCampaigns();
  }

  /**
   * Mağazadaki kampanyalar: yayında ve tarih aralığında olanlar. Kupon kodu yalnızca kupon
   * şu anda geçerliyse (aktif, tarihi uygun, kullanım hakkı bitmemiş) gösterilir: ölü kod ilan edilmez.
   */
  async publicCampaigns(now = new Date()) {
    const rows = await this.cached('campaigns', () =>
      this.prisma.campaign.findMany({ where: { isActive: true }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
    );
    const live = rows.filter((c) => (!c.startsAt || c.startsAt <= now) && (!c.endsAt || c.endsAt > now));
    const codes = [...new Set(live.map((c) => c.couponCode).filter((c): c is string => !!c))];
    const coupons = codes.length
      ? await this.prisma.coupon.findMany({ where: { code: { in: codes }, isActive: true }, select: { code: true, startsAt: true, endsAt: true, usageLimit: true, usedCount: true } })
      : [];
    const valid = new Set(
      coupons.filter((c) => (!c.startsAt || c.startsAt <= now) && (!c.endsAt || c.endsAt > now) && (c.usageLimit === null || c.usedCount < c.usageLimit)).map((c) => c.code),
    );
    return live.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      badge: c.badge,
      imageUrl: c.imageUrl,
      couponCode: c.couponCode && valid.has(c.couponCode) ? c.couponCode : null,
      linkUrl: c.linkUrl,
      linkLabel: c.linkLabel,
      endsAt: c.endsAt,
    }));
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
