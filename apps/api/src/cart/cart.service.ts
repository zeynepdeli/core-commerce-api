import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { hashToken, newSecureToken } from '../auth/secure-token.js';
import { fromKurus, toKurus } from '../commerce/money.js';
import { type PricingLine, quote } from '../commerce/pricing.js';
import { normalizeCouponCode } from '../coupons/coupon-code.js';
import { CouponsService, toPricingCoupon } from '../coupons/coupons.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StoreSettingsService } from '../store-settings/store-settings.service.js';

import { MAX_CART_LINES, MAX_LINE_QUANTITY } from './cart.dto.js';

export type CartOwner = { userId: string } | { guestToken: string | null };

const GUEST_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Satılabilir varyant: kendisi, ürünü ve kategorisi yayında ve silinmemiş */
export const SELLABLE_VARIANT: Prisma.ProductVariantWhereInput = {
  isActive: true,
  deletedAt: null,
  product: { isActive: true, deletedAt: null, category: { isActive: true, deletedAt: null } },
};

const ITEM_INCLUDE = {
  variant: {
    select: {
      id: true,
      name: true,
      price: true,
      compareAtPrice: true,
      stock: true,
      trackStock: true,
      isActive: true,
      deletedAt: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          vatRate: true,
          isActive: true,
          deletedAt: true,
          category: { select: { isActive: true, deletedAt: true } },
          images: { orderBy: { order: 'asc' as const }, take: 1, select: { url: true, alt: true } },
          _count: { select: { variants: { where: { deletedAt: null } } } },
        },
      },
    },
  },
} satisfies Prisma.CartItemInclude;

type LoadedItem = Prisma.CartItemGetPayload<{ include: typeof ITEM_INCLUDE }>;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: StoreSettingsService,
    private readonly coupons: CouponsService,
  ) {}

  // ───────────── Okuma ─────────────

  async view(owner: CartOwner) {
    const cart = await this.find(owner);
    return this.render(cart);
  }

  // ───────────── Yazma ─────────────

  /** Adet ayarla (0 = kaldır). Misafir sepeti yoksa oluşturulur; yeni token yanıtta bir kez döner. */
  async setItem(owner: CartOwner, variantId: string, quantity: number) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, ...SELLABLE_VARIANT },
      select: { id: true, stock: true, trackStock: true },
    });
    if (quantity > 0) {
      if (!variant) throw new NotFoundException('Bu ürün şu anda satışta değil.');
      if (variant.trackStock && quantity > variant.stock) {
        throw new ConflictException(variant.stock > 0 ? `Stokta yalnızca ${variant.stock} adet var.` : 'Bu ürün tükendi.');
      }
    }

    const { cart, cartToken } = await this.findOrCreate(owner);
    if (quantity === 0) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
    } else {
      const exists = await this.prisma.cartItem.findUnique({ where: { cartId_variantId: { cartId: cart.id, variantId } }, select: { id: true } });
      if (!exists && (await this.prisma.cartItem.count({ where: { cartId: cart.id } })) >= MAX_CART_LINES) {
        throw new BadRequestException(`Sepete en fazla ${MAX_CART_LINES} farklı ürün eklenebilir.`);
      }
      await this.prisma.cartItem.upsert({
        where: { cartId_variantId: { cartId: cart.id, variantId } },
        create: { cartId: cart.id, variantId, quantity },
        update: { quantity },
      });
    }
    await this.touch(cart.id, 'guestTokenHash' in cart && cart.guestTokenHash !== null);
    return { ...(await this.render(await this.find(owner, cartToken))), ...(cartToken ? { cartToken } : {}) };
  }

  async applyCoupon(owner: CartOwner, rawCode: string) {
    const code = normalizeCouponCode(rawCode);
    const coupon = await this.coupons.findByCode(code);
    // Var olmayan ve pasif kupon için AYNI mesaj (kod tahmini zorlaşsın)
    if (!coupon || !coupon.isActive) throw new BadRequestException('Kupon kodu geçersiz.');

    const cart = await this.find(owner);
    if (!cart) throw new BadRequestException('Sepetiniz boş.');
    const result = await this.render({ ...cart, couponCode: code });
    if (result.couponError) throw new BadRequestException(result.couponError);
    await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: code } });
    return result;
  }

  async removeCoupon(owner: CartOwner) {
    const cart = await this.find(owner);
    if (cart) await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
    return this.view(owner);
  }

  /**
   * Girişten sonra misafir sepeti üye sepetine aktarılır: aynı ürün varsa
   * adetler toplanır (stok ve 99 sınırına göre kırpılır), misafir sepeti silinir.
   */
  async merge(userId: string, guestToken: string) {
    const guest = await this.prisma.cart.findUnique({
      where: { guestTokenHash: hashToken(guestToken) },
      include: { items: { include: { variant: { select: { stock: true, trackStock: true } } } } },
    });
    if (!guest) return this.view({ userId });

    const { cart } = await this.findOrCreate({ userId });
    await this.prisma.$transaction(async (tx) => {
      for (const item of guest.items) {
        const existing = await tx.cartItem.findUnique({ where: { cartId_variantId: { cartId: cart.id, variantId: item.variantId } } });
        let quantity = Math.min((existing?.quantity ?? 0) + item.quantity, MAX_LINE_QUANTITY);
        if (item.variant.trackStock) quantity = Math.min(quantity, Math.max(item.variant.stock, 1));
        await tx.cartItem.upsert({
          where: { cartId_variantId: { cartId: cart.id, variantId: item.variantId } },
          create: { cartId: cart.id, variantId: item.variantId, quantity },
          update: { quantity },
        });
      }
      const count = await tx.cartItem.count({ where: { cartId: cart.id } });
      if (count > MAX_CART_LINES) throw new BadRequestException(`Sepete en fazla ${MAX_CART_LINES} farklı ürün eklenebilir.`);
      if (!cart.couponCode && guest.couponCode) await tx.cart.update({ where: { id: cart.id }, data: { couponCode: guest.couponCode } });
      await tx.cart.delete({ where: { id: guest.id } });
    });
    return this.view({ userId });
  }

  // ───────────── Yardımcılar ─────────────

  private async find(owner: CartOwner, newToken?: string | null) {
    const where =
      'userId' in owner
        ? { userId: owner.userId }
        : (newToken ?? owner.guestToken)
          ? { guestTokenHash: hashToken((newToken ?? owner.guestToken) as string) }
          : null;
    if (!where) return null;
    const cart = await this.prisma.cart.findUnique({ where, include: { items: { include: ITEM_INCLUDE, orderBy: { createdAt: 'asc' } } } });
    // Süresi dolmuş misafir sepeti yok sayılır (gece temizliği siler)
    if (cart?.expiresAt && cart.expiresAt <= new Date()) return null;
    return cart;
  }

  private async findOrCreate(owner: CartOwner) {
    if ('userId' in owner) {
      const cart = await this.prisma.cart.upsert({ where: { userId: owner.userId }, create: { userId: owner.userId }, update: {} });
      return { cart, cartToken: null };
    }
    if (owner.guestToken) {
      const cart = await this.prisma.cart.findUnique({ where: { guestTokenHash: hashToken(owner.guestToken) } });
      if (cart && (!cart.expiresAt || cart.expiresAt > new Date())) return { cart, cartToken: null };
    }
    const { token, hash } = newSecureToken();
    const cart = await this.prisma.cart.create({ data: { guestTokenHash: hash, expiresAt: new Date(Date.now() + GUEST_TTL_MS) } });
    return { cart, cartToken: token };
  }

  private async touch(cartId: string, isGuest: boolean) {
    await this.prisma.cart.update({
      where: { id: cartId },
      data: isGuest ? { expiresAt: new Date(Date.now() + GUEST_TTL_MS) } : { updatedAt: new Date() },
    });
  }

  /** Sepeti güncel fiyat/stokla hesaplar; satılamayan satırlar tutara katılmaz */
  async render(cart: { couponCode: string | null; items: LoadedItem[] } | null) {
    const items = (cart?.items ?? []).map((item) => {
      const v = item.variant;
      const p = v.product;
      const sellable = v.isActive && !v.deletedAt && p.isActive && !p.deletedAt && p.category.isActive && !p.category.deletedAt;
      const maxQuantity = v.trackStock ? Math.min(v.stock, MAX_LINE_QUANTITY) : MAX_LINE_QUANTITY;
      const problem = !sellable
        ? 'Bu ürün artık satışta değil.'
        : v.trackStock && v.stock === 0
          ? 'Bu ürün tükendi.'
          : item.quantity > maxQuantity
            ? `Stokta yalnızca ${v.stock} adet var.`
            : null;
      const unitPrice = toKurus(v.price);
      return {
        variantId: v.id,
        productId: p.id,
        productName: p.name,
        productSlug: p.slug,
        variantName: p._count.variants > 1 ? v.name : null,
        unit: v.name,
        image: p.images[0] ?? null,
        unitPrice: fromKurus(unitPrice),
        compareAtPrice: v.compareAtPrice === null ? null : fromKurus(toKurus(v.compareAtPrice)),
        quantity: item.quantity,
        lineTotal: fromKurus(unitPrice * item.quantity),
        available: problem === null,
        maxQuantity: sellable ? maxQuantity : 0,
        problem,
        _pricing: { unitPrice, vatRate: p.vatRate },
      };
    });

    const pricingLines: PricingLine[] = items
      .filter((i) => i.available)
      .map((i) => ({ variantId: i.variantId, quantity: i.quantity, unitPrice: i._pricing.unitPrice, vatRate: i._pricing.vatRate }));

    const couponRow = cart?.couponCode ? await this.coupons.findByCode(cart.couponCode) : null;
    const settings = await this.settings.pricing();
    const q = quote(pricingLines, settings, couponRow ? toPricingCoupon(couponRow) : null);
    const couponError = cart?.couponCode && !couponRow ? 'Kupon kodu geçersiz.' : q.couponError;

    return {
      items: items.map(({ _pricing: _p, ...rest }) => rest),
      itemCount: items.filter((i) => i.available).reduce((sum, i) => sum + i.quantity, 0),
      coupon: q.coupon,
      couponCode: cart?.couponCode ?? null,
      couponError,
      summary: {
        subtotal: fromKurus(q.subtotal),
        discount: fromKurus(q.discount),
        shipping: fromKurus(q.shipping),
        total: fromKurus(q.total),
        vat: fromKurus(q.vat),
        freeShippingRemaining: q.freeShippingRemaining === null ? null : fromKurus(q.freeShippingRemaining),
        belowMinimum: q.belowMinimum === null ? null : fromKurus(q.belowMinimum),
        currency: 'TRY',
      },
      // Sipariş verilebilir mi: boş değil, sorunlu satır yok, en düşük tutar aşıldı
      canCheckout: pricingLines.length > 0 && items.every((i) => i.available) && q.belowMinimum === null,
    };
  }
}
