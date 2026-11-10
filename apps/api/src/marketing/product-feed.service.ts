import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { fromKurus, toKurus } from '../commerce/money.js';
import type { Env } from '../config/env.validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StoreSettingsService } from '../store-settings/store-settings.service.js';

const CACHE_MS = 10 * 60_000;
const MAX_ITEMS = 50_000;

/** XML'e güvenli metin (kontrol karakterleri atılır, özel karakterler kaçışlanır) */
export function xml(text: string, max = 5000): string {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f￾￿]/g, '')
    .slice(0, max)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Ürün açıklaması düz metindir; yine de olası etiketler ve fazla boşluk temizlenir */
const plain = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Google Merchant Center ürün akışı (RSS 2.0 + g: alanları). Yalnızca mağazada görünen
 * ürünler ve herkese açık bilgiler; stok ADEDİ verilmez (yalnızca var/yok). 10 dk önbellek.
 */
@Injectable()
export class ProductFeedService {
  private readonly storefront: string;
  private readonly productPath: string;
  private readonly mediaBase: string;
  private cache: { at: number; body: string; etag: string } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: StoreSettingsService,
    config: ConfigService<Env, true>,
  ) {
    this.storefront = config.get('STOREFRONT_URL', { infer: true }).replace(/\/$/, '');
    this.productPath = config.get('STOREFRONT_PRODUCT_PATH', { infer: true });
    // Yerel depolamada görseller API'den (/media/...) sunulur
    this.mediaBase = (config.get('API_PUBLIC_URL', { infer: true }) ?? this.storefront).replace(/\/$/, '');
  }

  async google(now = Date.now()) {
    const s = await this.settings.seller();
    if (!s.productFeedEnabled) throw new NotFoundException();
    if (this.cache && now - this.cache.at < CACHE_MS) return this.cache;

    const products = await this.prisma.product.findMany({
      where: { isActive: true, deletedAt: null, category: { isActive: true, deletedAt: null }, images: { some: {} } },
      select: {
        id: true,
        name: true,
        slug: true,
        summary: true,
        description: true,
        category: { select: { name: true } },
        images: { orderBy: { order: 'asc' }, take: 11, select: { url: true } },
        variants: { where: { isActive: true, deletedAt: null }, orderBy: { order: 'asc' }, select: { id: true, name: true, sku: true, price: true, compareAtPrice: true, stock: true, trackStock: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_ITEMS,
    });

    const brand = s.feedBrand ?? s.sellerName ?? '';
    const abs = (url: string) => (/^https:\/\//.test(url) ? url : `${this.mediaBase}${url.startsWith('/') ? '' : '/'}${url}`);
    const items: string[] = [];
    for (const p of products) {
      const multi = p.variants.length > 1;
      const description = plain(p.summary || p.description || p.name);
      const base = `${this.storefront}${this.productPath.replace('{slug}', encodeURIComponent(p.slug))}`;
      for (const v of p.variants) {
        const price = toKurus(v.price);
        const compare = v.compareAtPrice ? toKurus(v.compareAtPrice) : 0;
        const onSale = compare > price;
        const fields = [
          `<g:id>${xml(v.sku || v.id, 50)}</g:id>`,
          multi ? `<g:item_group_id>${xml(p.id, 50)}</g:item_group_id>` : '',
          `<g:title>${xml(multi ? `${p.name} - ${v.name}` : p.name, 150)}</g:title>`,
          `<g:description>${xml(description, 5000)}</g:description>`,
          `<g:link>${xml(multi ? `${base}?v=${v.id}` : base)}</g:link>`,
          `<g:image_link>${xml(abs(p.images[0].url))}</g:image_link>`,
          ...p.images.slice(1, 11).map((i) => `<g:additional_image_link>${xml(abs(i.url))}</g:additional_image_link>`),
          `<g:availability>${!v.trackStock || v.stock > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>`,
          `<g:price>${fromKurus(onSale ? compare : price)} TRY</g:price>`,
          onSale ? `<g:sale_price>${fromKurus(price)} TRY</g:sale_price>` : '',
          `<g:condition>new</g:condition>`,
          brand ? `<g:brand>${xml(brand, 70)}</g:brand>` : '',
          `<g:identifier_exists>no</g:identifier_exists>`,
          `<g:product_type>${xml(p.category.name, 750)}</g:product_type>`,
          multi ? `<g:size>${xml(v.name, 100)}</g:size>` : '',
        ].filter(Boolean);
        items.push(`<item>${fields.join('')}</item>`);
      }
    }

    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
      '<channel>',
      `<title>${xml(s.sellerName ?? 'Ürünler', 150)}</title>`,
      `<link>${xml(this.storefront)}</link>`,
      `<description>${xml(`${s.sellerName ?? 'Mağaza'} ürün akışı`, 300)}</description>`,
      ...items,
      '</channel>',
      '</rss>',
    ].join('\n');
    this.cache = { at: now, body, etag: `"${items.length}-${Buffer.from(String(body.length)).toString('base64url')}-${now}"` };
    return this.cache;
  }

  invalidate() {
    this.cache = null;
  }
}
