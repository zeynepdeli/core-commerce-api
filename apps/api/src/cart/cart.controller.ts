import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { ApplyCouponDto } from '../coupons/coupons.dto.js';

import { MergeCartDto, SetCartItemDto } from './cart.dto.js';
import { type CartOwner, CartService } from './cart.service.js';

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Sepet: üye için Bearer token, misafir için X-Cart-Token başlığı.
 * Misafir sepeti ilk ürün eklendiğinde oluşur ve token yanıtta BİR KEZ
 * döner (`cartToken`); mağaza sunucusu bunu httpOnly çerezde saklar.
 */
@Controller('cart')
@UseGuards(OptionalJwtAuthGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  private owner(user: RequestUser | undefined, token: string | undefined): CartOwner {
    if (user) return { userId: user.id };
    return { guestToken: token && TOKEN.test(token) ? token : null };
  }

  @Get()
  get(@CurrentUser() user: RequestUser | undefined, @Headers('x-cart-token') token?: string) {
    return this.cart.view(this.owner(user, token));
  }

  @Put('items')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  setItem(@CurrentUser() user: RequestUser | undefined, @Body() dto: SetCartItemDto, @Headers('x-cart-token') token?: string) {
    return this.cart.setItem(this.owner(user, token), dto.variantId, dto.quantity);
  }

  @Delete('items/:variantId')
  removeItem(
    @CurrentUser() user: RequestUser | undefined,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Headers('x-cart-token') token?: string,
  ) {
    return this.cart.setItem(this.owner(user, token), variantId, 0);
  }

  // Kupon kodu tahminine karşı sıkı sınır
  @Post('coupon')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 }, long: { limit: 50, ttl: 3_600_000 } })
  applyCoupon(@CurrentUser() user: RequestUser | undefined, @Body() dto: ApplyCouponDto, @Headers('x-cart-token') token?: string) {
    return this.cart.applyCoupon(this.owner(user, token), dto.code);
  }

  @Delete('coupon')
  removeCoupon(@CurrentUser() user: RequestUser | undefined, @Headers('x-cart-token') token?: string) {
    return this.cart.removeCoupon(this.owner(user, token));
  }

  /** Girişten sonra misafir sepetini üye sepetine aktar */
  @Post('merge')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  merge(@CurrentUser() user: RequestUser, @Body() dto: MergeCartDto) {
    return this.cart.merge(user.id, dto.cartToken);
  }
}
