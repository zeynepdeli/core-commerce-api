import { Body, Controller, Get, HttpCode, HttpStatus, Injectable, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { hashToken } from '../auth/secure-token.js';
import { GuestOrderLookupDto } from '../checkout/checkout.dto.js';
import { clientIp } from '../common/client-ip.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { AdminOrdersService } from './admin-orders.service.js';
import { AdminOrdersQueryDto, PageQueryDto, UpdateOrderStatusDto } from './orders.dto.js';
import { OrdersService } from './orders.service.js';

const ORDER_NUMBER = /^\d{4}-[0-9A-Z]{8}$/;

/** Üyenin siparişleri */
@Controller('account/orders')
@UseGuards(JwtAuthGuard)
export class AccountOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query() query: PageQueryDto) {
    return this.orders.listForUser(user.id, query.page);
  }

  @Get(':orderNumber')
  get(@CurrentUser() user: RequestUser, @Param('orderNumber') orderNumber: string) {
    if (!ORDER_NUMBER.test(orderNumber)) throw new NotFoundException('Sipariş bulunamadı.');
    return this.orders.getForUser(user.id, orderNumber);
  }

  /** Müşteri yalnızca ödenmemiş siparişini iptal edebilir */
  @Post(':orderNumber/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@CurrentUser() user: RequestUser, @Param('orderNumber') orderNumber: string) {
    if (!ORDER_NUMBER.test(orderNumber)) throw new NotFoundException('Sipariş bulunamadı.');
    const order = await this.prisma.order.findFirst({ where: { orderNumber, userId: user.id }, select: { id: true } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı.');
    await this.orders.cancel(order.id, 'Müşteri tarafından iptal edildi.', null, ['PENDING']);
    return this.orders.getForUser(user.id, orderNumber);
  }
}

/** Misafir sipariş takibi: sipariş no + erişim anahtarı (POST: anahtar URL/loglara düşmesin) */
@Controller('orders')
export class GuestOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('lookup')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  lookup(@Body() dto: GuestOrderLookupDto) {
    return this.orders.getForGuest(dto.orderNumber, hashToken(dto.accessToken));
  }
}

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminOrdersController {
  constructor(
    private readonly admin: AdminOrdersService,
    private readonly orders: OrdersService,
  ) {}

  @Get()
  list(@Query() query: AdminOrdersQueryDto) {
    return this.admin.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.get(id);
  }

  @Patch(':id/status')
  async setStatus(@CurrentUser() actor: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrderStatusDto, @Req() req: Request) {
    await this.orders.transition(id, dto.status, actor.id, dto, clientIp(req).ip);
    return this.admin.get(id);
  }
}

/** Ödeme süresi dolan siparişleri iptal eder, stoğu geri ekler (5 dakikada bir) */
@Injectable()
export class OrderExpiryJob {
  constructor(private readonly orders: OrdersService) {}

  @Cron('*/5 * * * *', { name: 'order-expiry' })
  run() {
    return this.orders.expireUnpaid();
  }
}
