import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import type { CartOwner } from '../cart/cart.service.js';
import { clientIp, userAgent } from '../common/client-ip.js';

import { CheckoutDto, CheckoutPreviewDto } from './checkout.dto.js';
import { CheckoutService } from './checkout.service.js';

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

@Controller('checkout')
@UseGuards(OptionalJwtAuthGuard)
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  private owner(user: RequestUser | undefined, token?: string): CartOwner {
    return user ? { userId: user.id } : { guestToken: token && TOKEN.test(token) ? token : null };
  }

  private buyer(user: RequestUser | undefined) {
    return user ? { userId: user.id, email: user.email, name: user.name } : null;
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(@CurrentUser() user: RequestUser | undefined, @Body() dto: CheckoutPreviewDto, @Headers('x-cart-token') token?: string) {
    return this.checkout.preview(this.owner(user, token), this.buyer(user), dto);
  }

  // Stok ayırdığı için sıkı sınır (sahte siparişle stok kilitleme denemelerine karşı)
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 }, long: { limit: 30, ttl: 3_600_000 } })
  create(@CurrentUser() user: RequestUser | undefined, @Body() dto: CheckoutDto, @Req() req: Request, @Headers('x-cart-token') token?: string) {
    return this.checkout.create(this.owner(user, token), this.buyer(user), dto, { ipAddress: clientIp(req).ip, userAgent: userAgent(req) });
  }
}
